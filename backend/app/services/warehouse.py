from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import (
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    insert,
    select,
    text,
)
from sqlalchemy.engine import Engine

from app.api.schemas import LearnerProfile
from app.core.security import AuthService
from app.services.feature_engineering import build_feature_frame, build_feature_row


metadata = MetaData()

learner_sessions = Table(
    "learner_sessions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("learner_id", String(64), nullable=False),
    Column("hope", Integer, nullable=False),
    Column("courage", Integer, nullable=False),
    Column("wisdom", Integer, nullable=False),
    Column("leadership", Integer, nullable=False),
    Column("questions_answered", Integer, nullable=False),
    Column("accuracy_rate", Float, nullable=False),
    Column("historical_alignment", Float, nullable=False),
    Column("minutes_spent", Float, nullable=False),
    Column("achievement_count", Integer, nullable=False),
    Column("nonviolent_choices", Integer, nullable=False),
    Column("total_choices", Integer, nullable=False),
    Column("recommended_path", String(64), nullable=False),
    Column("engagement_risk", String(32), nullable=False),
    Column("created_at", String(64), nullable=False),
)

predictions = Table(
    "predictions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("learner_id", String(64), nullable=False),
    Column("payload_json", Text, nullable=False),
    Column("result_json", Text, nullable=False),
    Column("created_at", String(64), nullable=False),
)

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("username", String(64), unique=True, nullable=False),
    Column("password_salt", String(128), nullable=False),
    Column("password_hash", String(256), nullable=False),
    Column("role", String(32), nullable=False),
    Column("created_at", String(64), nullable=False),
)

workflow_runs = Table(
    "workflow_runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("workflow_name", String(64), nullable=False),
    Column("trigger", String(32), nullable=False),
    Column("status", String(32), nullable=False),
    Column("actor", String(64), nullable=False),
    Column("rows_processed", Integer, nullable=False, default=0),
    Column("started_at", String(64), nullable=False),
    Column("finished_at", String(64), nullable=True),
    Column("duration_ms", Integer, nullable=True),
    Column("message", Text, nullable=True),
    Column("details_json", Text, nullable=True),
)

warehouse_snapshots = Table(
    "warehouse_snapshots",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("snapshot_at", String(64), nullable=False),
    Column("learner_count", Integer, nullable=False),
    Column("average_mastery", Float, nullable=False),
    Column("average_accuracy", Float, nullable=False),
    Column("high_risk_share", Float, nullable=False),
    Column("details_json", Text, nullable=False),
)

agent_memories = Table(
    "agent_memories",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("learner_id", String(64), nullable=False),
    Column("agent_name", String(32), nullable=False),
    Column("display_name", String(64), nullable=False),
    Column("priority", String(16), nullable=False),
    Column("confidence", Float, nullable=False),
    Column("summary", Text, nullable=False),
    Column("predicted_path", String(64), nullable=False),
    Column("risk_band", String(32), nullable=False),
    Column("scene_focus", String(128), nullable=False),
    Column("actions_json", Text, nullable=False),
    Column("signals_json", Text, nullable=False),
    Column("knowledge_document_ids_json", Text, nullable=False),
    Column("created_at", String(64), nullable=False),
)

mission_plans = Table(
    "mission_plans",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("learner_id", String(64), nullable=False),
    Column("mission_title", String(128), nullable=False),
    Column("target_path", String(64), nullable=False),
    Column("target_scene", String(128), nullable=False),
    Column("policy_name", String(64), nullable=False),
    Column("plan_json", Text, nullable=False),
    Column("created_at", String(64), nullable=False),
)

experiment_assignments = Table(
    "experiment_assignments",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("learner_id", String(64), nullable=False),
    Column("policy_name", String(64), nullable=False),
    Column("policy_label", String(128), nullable=False),
    Column("rationale", Text, nullable=False),
    Column("exploitation_score", Float, nullable=False),
    Column("exploration_score", Float, nullable=False),
    Column("estimated_lift", Float, nullable=False),
    Column("context_json", Text, nullable=False),
    Column("assigned_at", String(64), nullable=False),
)

learner_events = Table(
    "learner_events",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("event_type", String(64), nullable=False),
    Column("source", String(64), nullable=False),
    Column("learner_id", String(64), nullable=True),
    Column("payload_json", Text, nullable=False),
    Column("created_at", String(64), nullable=False),
)

benchmark_reports = Table(
    "benchmark_reports",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("overall_score", Float, nullable=False),
    Column("report_json", Text, nullable=False),
    Column("generated_at", String(64), nullable=False),
)


class WarehouseService:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        self.engine: Engine = create_engine(
            database_url,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        self.backend_name = self.engine.url.get_backend_name()

    def initialize(self) -> None:
        metadata.create_all(self.engine)

    def ensure_admin_user(self, username: str, password: str, auth_service: AuthService) -> None:
        with self.engine.begin() as connection:
            existing = connection.execute(
                select(users.c.id).where(users.c.username == username)
            ).first()
            if existing is not None:
                return

            password_salt, password_hash = auth_service.hash_password(password)
            connection.execute(
                insert(users).values(
                    username=username,
                    password_salt=password_salt,
                    password_hash=password_hash,
                    role="admin",
                    created_at=datetime.now(UTC).isoformat(),
                )
            )

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        with self.engine.begin() as connection:
            row = connection.execute(
                select(
                    users.c.id,
                    users.c.username,
                    users.c.password_salt,
                    users.c.password_hash,
                    users.c.role,
                    users.c.created_at,
                ).where(users.c.username == username)
            ).mappings().first()
        return dict(row) if row else None

    def seed_demo_data(self, sample_size: int = 96) -> None:
        with self.engine.begin() as connection:
            existing = connection.execute(
                select(func.count()).select_from(learner_sessions)
            ).scalar_one()
            if existing:
                return

            rng = np.random.default_rng(1968)
            base_time = datetime.now(UTC)
            records: list[dict[str, Any]] = []

            for index in range(sample_size):
                hope = int(np.clip(rng.normal(70, 16), 18, 99))
                courage = int(np.clip(rng.normal(66, 18), 12, 99))
                wisdom = int(np.clip(rng.normal(72, 15), 18, 99))
                leadership = int(np.clip(rng.normal(69, 17), 15, 99))
                questions_answered = int(rng.integers(6, 28))
                accuracy_rate = round(float(np.clip(0.30 * wisdom + 0.25 * leadership + rng.normal(28, 10), 38, 98)), 2)
                historical_alignment = round(
                    float(np.clip(0.55 * accuracy_rate + 0.20 * wisdom + rng.normal(10, 8), 35, 99)),
                    2,
                )
                minutes_spent = round(float(np.clip(rng.normal(46, 18), 12, 150)), 1)
                achievement_count = int(np.clip(rng.normal(5, 2.5), 0, 12))
                total_choices = int(rng.integers(6, 18))
                nonviolent_choices = int(np.clip(total_choices - rng.integers(0, 4) + (hope > 65), 1, total_choices))

                base_row = build_feature_row(
                    {
                        "hope": hope,
                        "courage": courage,
                        "wisdom": wisdom,
                        "leadership": leadership,
                        "questions_answered": questions_answered,
                        "accuracy_rate": accuracy_rate,
                        "historical_alignment": historical_alignment,
                        "minutes_spent": minutes_spent,
                        "achievement_count": achievement_count,
                        "nonviolent_choices": nonviolent_choices,
                        "total_choices": total_choices,
                    }
                )

                path_scores = {
                    "movement_builder": 0.42 * leadership + 0.20 * courage + 0.20 * base_row["nonviolent_ratio"] + 0.18 * hope,
                    "speech_architect": 0.40 * hope + 0.32 * leadership + 0.28 * historical_alignment,
                    "policy_strategist": 0.44 * wisdom + 0.28 * historical_alignment + 0.16 * accuracy_rate + 0.12 * leadership,
                }
                recommended_path = max(path_scores, key=path_scores.get)

                if base_row["support_need_index"] >= 48 or accuracy_rate < 58:
                    engagement_risk = "high"
                elif base_row["support_need_index"] >= 28 or minutes_spent < 28:
                    engagement_risk = "moderate"
                else:
                    engagement_risk = "low"

                records.append(
                    {
                        "learner_id": f"seed-{index + 1:03d}",
                        "hope": hope,
                        "courage": courage,
                        "wisdom": wisdom,
                        "leadership": leadership,
                        "questions_answered": questions_answered,
                        "accuracy_rate": accuracy_rate,
                        "historical_alignment": historical_alignment,
                        "minutes_spent": minutes_spent,
                        "achievement_count": achievement_count,
                        "nonviolent_choices": nonviolent_choices,
                        "total_choices": total_choices,
                        "recommended_path": recommended_path,
                        "engagement_risk": engagement_risk,
                        "created_at": (base_time - timedelta(hours=index * 7)).isoformat(),
                    }
                )

            connection.execute(insert(learner_sessions), records)

    def fetch_sessions_frame(self) -> pd.DataFrame:
        with self.engine.begin() as connection:
            return pd.read_sql_query(text("SELECT * FROM learner_sessions ORDER BY created_at ASC"), connection)

    def fetch_predictions_frame(self) -> pd.DataFrame:
        with self.engine.begin() as connection:
            return pd.read_sql_query(text("SELECT * FROM predictions ORDER BY created_at DESC"), connection)

    def fetch_recent_learner_sessions(self, learner_id: str, limit: int = 6) -> list[dict[str, Any]]:
        with self.engine.begin() as connection:
            frame = pd.read_sql_query(
                text(
                    "SELECT * FROM learner_sessions "
                    "WHERE learner_id = :learner_id "
                    "ORDER BY created_at DESC LIMIT :limit"
                ),
                connection,
                params={"learner_id": learner_id, "limit": limit},
            )
        if frame.empty:
            return []
        return frame.fillna("").to_dict(orient="records")

    def fetch_workflow_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with self.engine.begin() as connection:
            frame = pd.read_sql_query(
                text("SELECT * FROM workflow_runs ORDER BY started_at DESC LIMIT :limit"),
                connection,
                params={"limit": limit},
            )
        if frame.empty:
            return []
        return frame.fillna("").to_dict(orient="records")

    def fetch_agent_memory(self, learner_id: str, limit: int = 12) -> list[dict[str, Any]]:
        with self.engine.begin() as connection:
            frame = pd.read_sql_query(
                text(
                    "SELECT learner_id, agent_name, display_name, priority, confidence, summary, "
                    "predicted_path, risk_band, scene_focus, knowledge_document_ids_json, created_at "
                    "FROM agent_memories WHERE learner_id = :learner_id "
                    "ORDER BY created_at DESC LIMIT :limit"
                ),
                connection,
                params={"learner_id": learner_id, "limit": limit},
            )
        if frame.empty:
            return []

        records = frame.fillna("").to_dict(orient="records")
        for record in records:
            record["knowledge_document_ids"] = json.loads(record.pop("knowledge_document_ids_json"))
        return records

    def record_agent_memories(
        self,
        learner_id: str,
        evaluation: dict[str, Any],
        agents: list[dict[str, Any]],
        knowledge_matches: list[dict[str, Any]],
    ) -> None:
        created_at = datetime.now(UTC).isoformat()
        knowledge_document_ids = [str(document["document_id"]) for document in knowledge_matches]
        rows = [
            {
                "learner_id": learner_id,
                "agent_name": str(agent["agent_name"]),
                "display_name": str(agent["display_name"]),
                "priority": str(agent["priority"]),
                "confidence": float(agent["confidence"]),
                "summary": str(agent["summary"]),
                "predicted_path": str(evaluation["predicted_path"]),
                "risk_band": str(evaluation["risk_band"]),
                "scene_focus": str(evaluation["suggested_scene_focus"]),
                "actions_json": json.dumps(agent["actions"]),
                "signals_json": json.dumps(agent["signals"]),
                "knowledge_document_ids_json": json.dumps(knowledge_document_ids),
                "created_at": created_at,
            }
            for agent in agents
        ]

        with self.engine.begin() as connection:
            connection.execute(insert(agent_memories), rows)
        self.record_event(
            event_type="agent_run",
            source="agent_service",
            learner_id=learner_id,
            payload={
                "agents": [agent["agent_name"] for agent in agents],
                "knowledge_documents": knowledge_document_ids,
            },
        )

    def persist_live_evaluation(self, profile: LearnerProfile, result: dict[str, object]) -> int:
        payload = profile.model_dump()
        created_at = datetime.now(UTC).isoformat()

        with self.engine.begin() as connection:
            prediction_result = connection.execute(
                insert(predictions).values(
                    learner_id=profile.learner_id,
                    payload_json=json.dumps(payload),
                    result_json=json.dumps(result),
                    created_at=created_at,
                )
            )

            connection.execute(
                insert(learner_sessions).values(
                    learner_id=profile.learner_id,
                    hope=profile.hope,
                    courage=profile.courage,
                    wisdom=profile.wisdom,
                    leadership=profile.leadership,
                    questions_answered=profile.questions_answered,
                    accuracy_rate=profile.accuracy_rate,
                    historical_alignment=profile.historical_alignment,
                    minutes_spent=profile.minutes_spent,
                    achievement_count=profile.achievement_count,
                    nonviolent_choices=profile.nonviolent_choices,
                    total_choices=profile.total_choices,
                    recommended_path=str(result["predicted_path"]),
                    engagement_risk=str(result["risk_band"]),
                    created_at=created_at,
                )
            )

        inserted_primary_key = prediction_result.inserted_primary_key[0]
        self.record_event(
            event_type="live_evaluation",
            source="warehouse",
            learner_id=profile.learner_id,
            payload={
                "predicted_path": result["predicted_path"],
                "risk_band": result["risk_band"],
            },
        )
        return int(inserted_primary_key)

    def record_workflow_run(
        self,
        workflow_name: str,
        trigger: str,
        status: str,
        actor: str,
        rows_processed: int,
        started_at: str,
        finished_at: str | None,
        duration_ms: int | None,
        message: str | None,
        details: dict[str, Any] | None = None,
    ) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                insert(workflow_runs).values(
                    workflow_name=workflow_name,
                    trigger=trigger,
                    status=status,
                    actor=actor,
                    rows_processed=rows_processed,
                    started_at=started_at,
                    finished_at=finished_at,
                    duration_ms=duration_ms,
                    message=message,
                    details_json=json.dumps(details or {}),
                )
            )
        self.record_event(
            event_type="workflow_run",
            source="orchestrator",
            learner_id=None,
            payload={
                "workflow_name": workflow_name,
                "status": status,
                "trigger": trigger,
            },
        )

    def create_warehouse_snapshot(self) -> dict[str, Any]:
        sessions = build_feature_frame(self.fetch_sessions_frame())
        if sessions.empty:
            snapshot = {
                "snapshot_at": datetime.now(UTC).isoformat(),
                "learner_count": 0,
                "average_mastery": 0.0,
                "average_accuracy": 0.0,
                "high_risk_share": 0.0,
                "details": {},
                "rows_processed": 0,
            }
        else:
            snapshot = {
                "snapshot_at": datetime.now(UTC).isoformat(),
                "learner_count": int(len(sessions)),
                "average_mastery": round(float(sessions["mastery_index"].mean()), 1),
                "average_accuracy": round(float(sessions["accuracy_rate"].mean()), 1),
                "high_risk_share": round(float((sessions["engagement_risk"] == "high").mean() * 100), 1),
                "details": {
                    "top_path": str(sessions["recommended_path"].mode().iloc[0]),
                    "avg_support_need": round(float(sessions["support_need_index"].mean()), 1),
                    "avg_coalition_index": round(float(sessions["coalition_index"].mean()), 1),
                },
                "rows_processed": int(len(sessions)),
            }

        with self.engine.begin() as connection:
            inserted = connection.execute(
                insert(warehouse_snapshots).values(
                    snapshot_at=snapshot["snapshot_at"],
                    learner_count=snapshot["learner_count"],
                    average_mastery=snapshot["average_mastery"],
                    average_accuracy=snapshot["average_accuracy"],
                    high_risk_share=snapshot["high_risk_share"],
                    details_json=json.dumps(snapshot["details"]),
                )
            )

        snapshot["snapshot_id"] = int(inserted.inserted_primary_key[0])
        self.record_event(
            event_type="warehouse_snapshot",
            source="warehouse",
            learner_id=None,
            payload={
                "snapshot_id": snapshot["snapshot_id"],
                "rows_processed": snapshot["rows_processed"],
            },
        )
        return snapshot

    def get_latest_snapshot(self) -> dict[str, Any] | None:
        with self.engine.begin() as connection:
            row = connection.execute(
                select(
                    warehouse_snapshots.c.id,
                    warehouse_snapshots.c.snapshot_at,
                    warehouse_snapshots.c.learner_count,
                    warehouse_snapshots.c.average_mastery,
                    warehouse_snapshots.c.average_accuracy,
                    warehouse_snapshots.c.high_risk_share,
                    warehouse_snapshots.c.details_json,
                )
                .order_by(warehouse_snapshots.c.snapshot_at.desc())
                .limit(1)
            ).mappings().first()

        if row is None:
            return None

        payload = dict(row)
        payload["details"] = json.loads(payload.pop("details_json"))
        return payload

    def record_mission_plan(self, learner_id: str, plan_payload: dict[str, Any]) -> int:
        created_at = str(plan_payload["generated_at"])
        with self.engine.begin() as connection:
            result = connection.execute(
                insert(mission_plans).values(
                    learner_id=learner_id,
                    mission_title=str(plan_payload["mission_title"]),
                    target_path=str(plan_payload["target_path"]),
                    target_scene=str(plan_payload["target_scene"]),
                    policy_name=str(plan_payload["experiment_policy"]["policy_name"]),
                    plan_json=json.dumps(plan_payload),
                    created_at=created_at,
                )
            )

        plan_id = int(result.inserted_primary_key[0])
        self.record_event(
            event_type="mission_plan",
            source="planner_service",
            learner_id=learner_id,
            payload={
                "plan_id": plan_id,
                "policy_name": plan_payload["experiment_policy"]["policy_name"],
                "target_scene": plan_payload["target_scene"],
            },
        )
        return plan_id

    def get_latest_mission_plan(self, learner_id: str) -> dict[str, Any] | None:
        with self.engine.begin() as connection:
            row = connection.execute(
                select(mission_plans.c.id, mission_plans.c.plan_json)
                .where(mission_plans.c.learner_id == learner_id)
                .order_by(mission_plans.c.created_at.desc())
                .limit(1)
            ).first()

        if row is None:
            return None

        payload = json.loads(row[1])
        payload["plan_id"] = int(row[0])
        return payload

    def record_benchmark_report(self, report_payload: dict[str, Any]) -> int:
        generated_at = str(report_payload["generated_at"])
        with self.engine.begin() as connection:
            result = connection.execute(
                insert(benchmark_reports).values(
                    overall_score=float(report_payload["overall_score"]),
                    report_json=json.dumps(report_payload),
                    generated_at=generated_at,
                )
            )

        report_id = int(result.inserted_primary_key[0])
        self.record_event(
            event_type="benchmark_report",
            source="benchmark_service",
            learner_id=None,
            payload={
                "benchmark_report_id": report_id,
                "overall_score": report_payload["overall_score"],
            },
        )
        return report_id

    def get_latest_benchmark_report(self) -> dict[str, Any] | None:
        with self.engine.begin() as connection:
            row = connection.execute(
                select(benchmark_reports.c.id, benchmark_reports.c.report_json)
                .order_by(benchmark_reports.c.generated_at.desc())
                .limit(1)
            ).first()

        if row is None:
            return None

        payload = json.loads(row[1])
        payload["report_id"] = int(row[0])
        return payload

    def record_experiment_assignment(
        self,
        learner_id: str,
        policy_name: str,
        policy_label: str,
        rationale: str,
        exploitation_score: float,
        exploration_score: float,
        estimated_lift: float,
        assigned_at: str,
        context: dict[str, Any],
    ) -> int:
        with self.engine.begin() as connection:
            result = connection.execute(
                insert(experiment_assignments).values(
                    learner_id=learner_id,
                    policy_name=policy_name,
                    policy_label=policy_label,
                    rationale=rationale,
                    exploitation_score=exploitation_score,
                    exploration_score=exploration_score,
                    estimated_lift=estimated_lift,
                    context_json=json.dumps(context),
                    assigned_at=assigned_at,
                )
            )

        assignment_id = int(result.inserted_primary_key[0])
        self.record_event(
            event_type="experiment_assignment",
            source="experiment_service",
            learner_id=learner_id,
            payload={
                "assignment_id": assignment_id,
                "policy_name": policy_name,
                "estimated_lift": estimated_lift,
            },
        )
        return assignment_id

    def fetch_experiment_metrics(self) -> dict[str, Any]:
        with self.engine.begin() as connection:
            frame = pd.read_sql_query(
                text(
                    "SELECT policy_name, policy_label, COUNT(*) AS assignment_count, "
                    "AVG(estimated_lift) AS average_estimated_lift "
                    "FROM experiment_assignments GROUP BY policy_name, policy_label ORDER BY assignment_count DESC"
                ),
                connection,
            )

        if frame.empty:
            return {"total_assignments": 0, "policies": []}

        policies = frame.fillna(0).round({"average_estimated_lift": 1}).to_dict(orient="records")
        return {
            "total_assignments": int(frame["assignment_count"].sum()),
            "policies": policies,
        }

    def record_event(
        self,
        event_type: str,
        source: str,
        learner_id: str | None,
        payload: dict[str, Any] | None = None,
    ) -> int:
        created_at = datetime.now(UTC).isoformat()
        with self.engine.begin() as connection:
            result = connection.execute(
                insert(learner_events).values(
                    event_type=event_type,
                    source=source,
                    learner_id=learner_id,
                    payload_json=json.dumps(payload or {}),
                    created_at=created_at,
                )
            )

        return int(result.inserted_primary_key[0])

    def fetch_event_pipeline(self, limit: int = 20) -> dict[str, Any]:
        with self.engine.begin() as connection:
            counts_frame = pd.read_sql_query(
                text(
                    "SELECT event_type, COUNT(*) AS count FROM learner_events "
                    "GROUP BY event_type ORDER BY count DESC"
                ),
                connection,
            )
            recent_frame = pd.read_sql_query(
                text(
                    "SELECT event_type, source, learner_id, payload_json, created_at "
                    "FROM learner_events ORDER BY created_at DESC LIMIT :limit"
                ),
                connection,
                params={"limit": limit},
            )

        latest_event_at = None if recent_frame.empty else str(recent_frame.iloc[0]["created_at"])
        recent_events = []
        if not recent_frame.empty:
            for record in recent_frame.fillna("").to_dict(orient="records"):
                payload = json.loads(record["payload_json"])
                recent_events.append(
                    {
                        "event_type": record["event_type"],
                        "source": record["source"],
                        "learner_id": record["learner_id"] or None,
                        "created_at": record["created_at"],
                        "payload_preview": ", ".join(f"{key}={value}" for key, value in list(payload.items())[:3]),
                    }
                )

        return {
            "total_events": int(counts_frame["count"].sum()) if not counts_frame.empty else 0,
            "latest_event_at": latest_event_at,
            "event_types": counts_frame.to_dict(orient="records") if not counts_frame.empty else [],
            "recent_events": recent_events,
        }

    def get_dashboard_snapshot(self) -> dict[str, object]:
        sessions = build_feature_frame(self.fetch_sessions_frame())
        predictions_frame = self.fetch_predictions_frame()

        if sessions.empty:
            return {
                "headline_metrics": {},
                "path_distribution": [],
                "risk_distribution": [],
                "weekly_mastery_trend": [],
                "cohort_segments": [],
                "recent_sessions": [],
                "recent_predictions": [],
                "latest_snapshot": self.get_latest_snapshot(),
                "legacy_url": "/legacy",
            }

        headline_metrics = {
            "learners_total": int(len(sessions)),
            "average_mastery": round(float(sessions["mastery_index"].mean()), 1),
            "average_accuracy": round(float(sessions["accuracy_rate"].mean()), 1),
            "average_time_minutes": round(float(sessions["minutes_spent"].mean()), 1),
            "high_risk_share": round(float((sessions["engagement_risk"] == "high").mean() * 100), 1),
            "policy_ready_share": round(float((sessions["recommended_path"] == "policy_strategist").mean() * 100), 1),
        }

        path_distribution = [
            {
                "label": label.replace("_", " ").title(),
                "count": int(count),
                "share": round(float(count / len(sessions) * 100), 1),
            }
            for label, count in sessions["recommended_path"].value_counts().items()
        ]

        risk_distribution = [
            {
                "label": label.title(),
                "count": int(count),
                "share": round(float(count / len(sessions) * 100), 1),
            }
            for label, count in sessions["engagement_risk"].value_counts().items()
        ]

        weekly_mastery_trend = (
            sessions.assign(day=pd.to_datetime(sessions["created_at"]).dt.strftime("%b %d"))
            .groupby("day", as_index=False)
            .agg(
                mastery=("mastery_index", "mean"),
                accuracy=("accuracy_rate", "mean"),
                support_need=("support_need_index", "mean"),
            )
            .tail(7)
            .round(1)
            .to_dict(orient="records")
        )

        segmented = sessions.assign(
            segment=np.select(
                [
                    sessions["support_need_index"] >= 45,
                    sessions["mastery_index"] >= 78,
                    sessions["coalition_index"] >= 74,
                ],
                [
                    "Acceleration Needed",
                    "High Mastery",
                    "Coalition Builders",
                ],
                default="Growing Leaders",
            )
        )
        cohort_segments = (
            segmented.groupby("segment", as_index=False)
            .agg(
                learner_count=("id", "count"),
                avg_mastery=("mastery_index", "mean"),
                avg_accuracy=("accuracy_rate", "mean"),
                avg_time=("minutes_spent", "mean"),
            )
            .round(1)
            .sort_values("learner_count", ascending=False)
            .to_dict(orient="records")
        )

        recent_sessions = (
            sessions.sort_values("created_at", ascending=False)
            .head(8)
            .assign(
                learner_label=lambda frame: frame["learner_id"].str.replace("-", " ").str.title(),
                narrative_focus=lambda frame: frame["recommended_path"].str.replace("_", " ").str.title(),
            )[
                [
                    "learner_label",
                    "narrative_focus",
                    "engagement_risk",
                    "mastery_index",
                    "accuracy_rate",
                    "created_at",
                ]
            ]
            .round({"mastery_index": 1, "accuracy_rate": 1})
            .to_dict(orient="records")
        )

        recent_predictions = []
        if not predictions_frame.empty:
            recent_predictions = (
                predictions_frame.head(5)
                .assign(
                    learner_label=lambda frame: frame["learner_id"].str.replace("-", " ").str.title(),
                )[["learner_label", "created_at"]]
                .to_dict(orient="records")
            )

        return {
            "headline_metrics": headline_metrics,
            "path_distribution": path_distribution,
            "risk_distribution": risk_distribution,
            "weekly_mastery_trend": weekly_mastery_trend,
            "cohort_segments": cohort_segments,
            "recent_sessions": recent_sessions,
            "recent_predictions": recent_predictions,
            "latest_snapshot": self.get_latest_snapshot(),
            "legacy_url": "/legacy",
        }
