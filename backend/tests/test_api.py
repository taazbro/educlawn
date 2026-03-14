from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_overview_and_admin_workflow_flow(tmp_path):
    settings = Settings(
        db_path=tmp_path / "test.sqlite3",
        workflow_scheduler_enabled=False,
        admin_password="mlk-admin-demo",
    )
    app = create_app(settings)

    with TestClient(app) as client:
        profile_payload = {
            "learner_id": "test-learner",
            "hope": 77,
            "courage": 64,
            "wisdom": 81,
            "leadership": 72,
            "questions_answered": 18,
            "accuracy_rate": 91,
            "historical_alignment": 93,
            "minutes_spent": 48,
            "achievement_count": 7,
            "nonviolent_choices": 10,
            "total_choices": 11,
        }

        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"
        assert health.json()["database_backend"] == "sqlite"
        assert health.json()["scheduler"]["enabled"] is False
        assert health.json()["scheduler"]["benchmark_interval_seconds"] > 0

        overview = client.get("/api/v1/overview")
        assert overview.status_code == 200
        payload = overview.json()
        assert payload["headline_metrics"]["learners_total"] > 0
        assert payload["model_summary"]["trained"] is True
        assert payload["latest_snapshot"]["learner_count"] > 0

        catalog = client.get("/api/v1/agents/catalog")
        assert catalog.status_code == 200
        catalog_payload = catalog.json()
        assert len(catalog_payload) == 5
        assert any(agent["name"] == "operations" for agent in catalog_payload)
        assert any(agent["name"] == "planner" for agent in catalog_payload)

        agent_run = client.post(
            "/api/v1/agents/run",
            json={
                "profile": profile_payload,
            },
        )
        assert agent_run.status_code == 200
        agent_run_payload = agent_run.json()
        assert agent_run_payload["evaluation"]["predicted_path"]
        assert len(agent_run_payload["agents"]) == 3
        assert {agent["agent_name"] for agent in agent_run_payload["agents"]} == {"mentor", "strategist", "historian"}
        assert len(agent_run_payload["knowledge_matches"]) == 3
        assert agent_run_payload["memory"]["summary"]["learner_id"] == "test-learner"
        assert len(agent_run_payload["memory"]["timeline"]) == 3

        agent_memory = client.get("/api/v1/agents/memory/test-learner")
        assert agent_memory.status_code == 200
        memory_payload = agent_memory.json()
        assert memory_payload["summary"]["run_count"] >= 3
        assert memory_payload["timeline"][0]["learner_id"] == "test-learner"

        unauthorized_status = client.get("/api/v1/admin/status")
        assert unauthorized_status.status_code == 401

        login = client.post(
            "/api/v1/auth/login",
            json={
                "username": "admin",
                "password": "mlk-admin-demo",
            },
        )
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        admin_status = client.get("/api/v1/admin/status", headers=headers)
        assert admin_status.status_code == 200
        admin_payload = admin_status.json()
        assert admin_payload["current_user"]["username"] == "admin"
        assert admin_payload["scheduler"]["enabled"] is False
        assert admin_payload["scheduler"]["benchmark_interval_seconds"] > 0
        assert admin_payload["model_summary"]["trained"] is True

        admin_briefing = client.get("/api/v1/admin/agents/briefing", headers=headers)
        assert admin_briefing.status_code == 200
        admin_briefing_payload = admin_briefing.json()
        assert admin_briefing_payload["operations_agent"]["agent_name"] == "operations"
        assert admin_briefing_payload["operations_agent"]["actions"]

        event_pipeline = client.get("/api/v1/admin/pipeline/events", headers=headers)
        assert event_pipeline.status_code == 200
        event_payload = event_pipeline.json()
        assert event_payload["total_events"] > 0
        assert event_payload["event_types"]

        experiment_metrics = client.get("/api/v1/admin/experiments/metrics", headers=headers)
        assert experiment_metrics.status_code == 200
        experiment_metrics_payload = experiment_metrics.json()
        assert experiment_metrics_payload["total_assignments"] >= 0
        assert experiment_metrics_payload["policies"]

        benchmarks = client.post("/api/v1/admin/benchmarks/run", headers=headers)
        assert benchmarks.status_code == 200
        benchmark_payload = benchmarks.json()
        assert benchmark_payload["overall_score"] > 0
        assert len(benchmark_payload["benchmarks"]) >= 5

        latest_benchmark = client.get("/api/v1/admin/benchmarks/latest", headers=headers)
        assert latest_benchmark.status_code == 200
        assert latest_benchmark.json()["overall_score"] == benchmark_payload["overall_score"]

        evaluation = client.post(
            "/api/v1/lab/evaluate",
            json=profile_payload,
        )
        assert evaluation.status_code == 200
        result = evaluation.json()
        assert result["predicted_path"]
        assert result["risk_band"] in {"low", "moderate", "high"}
        assert len(result["top_drivers"]) == 5
        assert result["model_summary"]["trained"] is True

        temporal = client.get("/api/v1/temporal/learner/test-learner")
        assert temporal.status_code == 200
        temporal_payload = temporal.json()
        assert temporal_payload["learner_id"] == "test-learner"
        assert temporal_payload["momentum_label"]

        graph = client.get(
            "/api/v1/graph/context",
            params={
                "scene_focus": result["suggested_scene_focus"],
                "predicted_path": result["predicted_path"],
            },
        )
        assert graph.status_code == 200
        graph_payload = graph.json()
        assert len(graph_payload["nodes"]) >= 4
        assert len(graph_payload["edges"]) >= 3

        experiment = client.post(
            "/api/v1/experiments/recommend",
            json={"profile": profile_payload},
        )
        assert experiment.status_code == 200
        experiment_payload = experiment.json()
        assert experiment_payload["policy_name"]
        assert experiment_payload["assignment_id"] > 0

        experiment_metrics = client.get("/api/v1/admin/experiments/metrics", headers=headers)
        assert experiment_metrics.status_code == 200
        experiment_metrics_payload = experiment_metrics.json()
        assert experiment_metrics_payload["total_assignments"] > 0

        mission_plan = client.post(
            "/api/v1/planner/run",
            json={"profile": profile_payload},
        )
        assert mission_plan.status_code == 200
        mission_plan_payload = mission_plan.json()
        assert mission_plan_payload["plan_id"] > 0
        assert mission_plan_payload["planner_agent"]["agent_name"] == "planner"
        assert len(mission_plan_payload["steps"]) >= 4
        assert mission_plan_payload["graph_context"]["nodes"]

        latest_plan = client.get("/api/v1/planner/latest/test-learner")
        assert latest_plan.status_code == 200
        assert latest_plan.json()["plan_id"] == mission_plan_payload["plan_id"]

        retrain = client.post("/api/v1/pipeline/retrain", headers=headers)
        assert retrain.status_code == 200
        retrain_payload = retrain.json()
        assert retrain_payload["training_rows"] > 0
        assert retrain_payload["trained_at"]

        workflow_trigger = client.post(
            "/api/v1/workflows/trigger",
            headers=headers,
            json={"workflow_name": "benchmark_suite"},
        )
        assert workflow_trigger.status_code == 200
        workflow_payload = workflow_trigger.json()
        assert workflow_payload["workflow_name"] == "benchmark_suite"
        assert workflow_payload["status"] == "success"

        workflow_runs = client.get("/api/v1/workflows/runs", headers=headers)
        assert workflow_runs.status_code == 200
        runs_payload = workflow_runs.json()
        assert len(runs_payload) >= 2
        assert any(run["workflow_name"] == "benchmark_suite" for run in runs_payload)
        assert any(run["workflow_name"] == "model_retrain" for run in runs_payload)

        sessions = client.get("/api/v1/sessions")
        assert sessions.status_code == 200
        assert len(sessions.json()) > 0


def test_login_rejects_invalid_password(tmp_path):
    settings = Settings(
        db_path=tmp_path / "auth.sqlite3",
        workflow_scheduler_enabled=False,
        admin_password="mlk-admin-demo",
    )
    app = create_app(settings)

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={
                "username": "admin",
                "password": "wrong-password",
            },
        )
        assert login.status_code == 401
