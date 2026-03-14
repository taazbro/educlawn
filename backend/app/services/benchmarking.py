from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.api.schemas import LearnerProfile
from app.services.experimentation import ExperimentationService
from app.services.graph import KnowledgeGraphService
from app.services.knowledge import LocalKnowledgeService
from app.services.planner import MissionPlannerService
from app.services.temporal import TemporalLearnerModel
from app.services.warehouse import WarehouseService


class BenchmarkService:
    def __init__(
        self,
        warehouse: WarehouseService,
        knowledge_service: LocalKnowledgeService,
        graph_service: KnowledgeGraphService,
        temporal_model: TemporalLearnerModel,
        planner_service: MissionPlannerService,
        experimentation_service: ExperimentationService,
    ) -> None:
        self.warehouse = warehouse
        self.knowledge_service = knowledge_service
        self.graph_service = graph_service
        self.temporal_model = temporal_model
        self.planner_service = planner_service
        self.experimentation_service = experimentation_service

    def run(self) -> dict[str, Any]:
        scenario_profile = LearnerProfile(
            learner_id="benchmark-learner",
            hope=81,
            courage=69,
            wisdom=88,
            leadership=76,
            questions_answered=24,
            accuracy_rate=93,
            historical_alignment=91,
            minutes_spent=54,
            achievement_count=9,
            nonviolent_choices=12,
            total_choices=13,
        )

        plan = self.planner_service.generate_plan(scenario_profile)
        retrieval = self.knowledge_service.search(plan["target_scene"], plan["target_path"], plan["temporal_state"]["current_risk"])
        index_status = self.knowledge_service.get_index_status()
        graph_context = self.graph_service.get_context(plan["target_scene"], plan["target_path"])
        temporal_state = self.temporal_model.build_state(
            learner_id=scenario_profile.learner_id,
            current_evaluation=plan["planner_agent"] | {
                "predicted_path": plan["target_path"],
                "risk_band": plan["temporal_state"]["current_risk"],
            },
            current_profile=scenario_profile.model_dump(),
        )
        experiment = self.experimentation_service.recommend(
            learner_id=f"{scenario_profile.learner_id}-experiment",
            evaluation={
                "predicted_path": plan["target_path"],
                "risk_band": plan["temporal_state"]["current_risk"],
            },
            temporal_state=plan["temporal_state"],
        )
        events = self.warehouse.fetch_event_pipeline(limit=10)

        top_vector_score = float(retrieval[0].get("vector_score", 0.0)) if retrieval else 0.0
        retrieval_score = 70.0
        if retrieval and retrieval[0]["relevance"] >= 72:
            retrieval_score += 18.0
        if top_vector_score >= 40:
            retrieval_score += 8.0
        if int(index_status["embedding_dimensions"]) >= 3 and int(index_status["documents_indexed"]) >= 8:
            retrieval_score += 4.0
        planner_score = min(100.0, 60.0 + len(plan["steps"]) * 8 + len(plan["checkpoints"]) * 4)
        temporal_score = 92.0 if temporal_state["session_count"] >= 1 and temporal_state["momentum_label"] else 60.0
        graph_score = 95.0 if len(graph_context["nodes"]) >= 4 and len(graph_context["edges"]) >= 3 else 68.0
        experiment_score = 88.0 if experiment["estimated_lift"] >= 40 else 65.0
        event_score = 90.0 if events["total_events"] >= 1 else 55.0

        benchmarks = [
            self._entry(
                "retrieval_quality",
                retrieval_score,
                "Local hybrid retrieval returned vector-ranked documents with metadata-aware grounding.",
            ),
            self._entry("planner_completeness", planner_score, "Planner produced a multi-step mission with checkpoints and fallback branches."),
            self._entry("temporal_model", temporal_score, "Temporal learner state generated momentum and intervention metrics."),
            self._entry("graph_context", graph_score, "Knowledge graph returned enough nodes and edges for scene reasoning."),
            self._entry("experiment_policy", experiment_score, "Policy engine selected an intervention with non-trivial expected lift."),
            self._entry("event_pipeline", event_score, "Event pipeline is recording intelligence operations into the warehouse."),
        ]

        overall_score = round(sum(item["score"] for item in benchmarks) / len(benchmarks), 1)
        recommendations = [
            "Raise retrieval depth by adding more local documents and graph links per scene.",
            "Track real post-intervention outcomes so experiment metrics move beyond estimated lift.",
            "Feed benchmark results into a recurring admin workflow to detect regressions earlier.",
        ]

        report = {
            "generated_at": datetime.now(UTC).isoformat(),
            "overall_score": overall_score,
            "benchmarks": benchmarks,
            "recommendations": recommendations,
        }

        self.warehouse.record_benchmark_report(report)
        self.warehouse.record_event(
            event_type="benchmark_run",
            source="benchmark_service",
            learner_id=None,
            payload={"overall_score": overall_score},
        )
        return report

    def _entry(self, name: str, score: float, summary: str) -> dict[str, Any]:
        if score >= 85:
            status = "pass"
        elif score >= 70:
            status = "warn"
        else:
            status = "fail"
        return {
            "benchmark_name": name,
            "score": round(score, 1),
            "status": status,
            "summary": summary,
        }
