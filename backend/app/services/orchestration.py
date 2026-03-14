from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from app.core.config import Settings
from app.services.benchmarking import BenchmarkService
from app.services.ml import LearningIntelligenceService
from app.services.warehouse import WarehouseService


class WorkflowOrchestrator:
    def __init__(
        self,
        settings: Settings,
        warehouse: WarehouseService,
        intelligence: LearningIntelligenceService,
        benchmark_service: BenchmarkService,
    ) -> None:
        self.settings = settings
        self.warehouse = warehouse
        self.intelligence = intelligence
        self.benchmark_service = benchmark_service
        self._shutdown_event = asyncio.Event()
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        if not self.settings.workflow_scheduler_enabled:
            return

        self._shutdown_event.clear()
        self._tasks = [
            asyncio.create_task(self._periodic_runner("etl_snapshot", self.settings.etl_interval_seconds)),
            asyncio.create_task(self._periodic_runner("model_retrain", self.settings.retrain_interval_seconds)),
            asyncio.create_task(self._periodic_runner("benchmark_suite", self.settings.benchmark_interval_seconds)),
        ]

    async def shutdown(self) -> None:
        self._shutdown_event.set()
        for task in self._tasks:
            task.cancel()

        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []

    async def run_workflow(
        self,
        workflow_name: str,
        trigger: str = "manual",
        actor: str = "system",
    ) -> dict[str, Any]:
        started_at = datetime.now(UTC).isoformat()
        details: dict[str, Any] = {}
        rows_processed = 0
        status = "success"
        message = ""

        try:
            if workflow_name == "etl_snapshot":
                details = await asyncio.to_thread(self.warehouse.create_warehouse_snapshot)
                rows_processed = int(details.get("rows_processed", 0))
                message = "Warehouse snapshot materialized."
            elif workflow_name == "model_retrain":
                details = await asyncio.to_thread(self.intelligence.train_models)
                rows_processed = int(details.get("training_rows", 0))
                message = "Model retraining complete."
            elif workflow_name == "full_refresh":
                etl_result = await asyncio.to_thread(self.warehouse.create_warehouse_snapshot)
                model_result = await asyncio.to_thread(self.intelligence.train_models)
                rows_processed = int(model_result.get("training_rows", 0))
                details = {
                    "etl_snapshot": etl_result,
                    "model_retrain": model_result,
                }
                message = "ETL snapshot and model retraining complete."
            elif workflow_name == "benchmark_suite":
                details = await asyncio.to_thread(self.benchmark_service.run)
                rows_processed = int(len(details.get("benchmarks", [])))
                message = "Benchmark suite complete."
            else:
                raise ValueError(f"Unsupported workflow: {workflow_name}")
        except Exception as error:
            status = "failed"
            message = str(error)
            details = {"error": str(error)}
            raise
        finally:
            finished_at = datetime.now(UTC).isoformat()
            duration_ms = int(
                (
                    datetime.fromisoformat(finished_at) - datetime.fromisoformat(started_at)
                ).total_seconds()
                * 1000
            )
            await asyncio.to_thread(
                self.warehouse.record_workflow_run,
                workflow_name=workflow_name,
                trigger=trigger,
                status=status,
                actor=actor,
                rows_processed=rows_processed,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms,
                message=message,
                details=details,
            )

        return {
            "workflow_name": workflow_name,
            "trigger": trigger,
            "status": status,
            "details": details,
        }

    def get_scheduler_status(self) -> dict[str, int | bool]:
        return {
            "enabled": self.settings.workflow_scheduler_enabled,
            "etl_interval_seconds": self.settings.etl_interval_seconds,
            "retrain_interval_seconds": self.settings.retrain_interval_seconds,
            "benchmark_interval_seconds": self.settings.benchmark_interval_seconds,
            "active_tasks": len([task for task in self._tasks if not task.done()]),
        }

    async def _periodic_runner(self, workflow_name: str, interval_seconds: int) -> None:
        while not self._shutdown_event.is_set():
            try:
                await asyncio.wait_for(self._shutdown_event.wait(), timeout=interval_seconds)
                break
            except TimeoutError:
                try:
                    await self.run_workflow(workflow_name, trigger="scheduled", actor="scheduler")
                except Exception:
                    continue
