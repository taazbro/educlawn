from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import Settings
from app.core.security import AuthService
from app.services.agents import LocalAgentService
from app.services.benchmarking import BenchmarkService
from app.services.experimentation import ExperimentationService
from app.services.graph import KnowledgeGraphService
from app.services.knowledge import LocalKnowledgeService
from app.services.ml import LearningIntelligenceService
from app.services.orchestration import WorkflowOrchestrator
from app.services.planner import MissionPlannerService
from app.services.temporal import TemporalLearnerModel
from app.services.warehouse import WarehouseService


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        warehouse = WarehouseService(resolved_settings.database_url)
        warehouse.initialize()
        warehouse.seed_demo_data()

        auth_service = AuthService(
            secret=resolved_settings.auth_secret,
            token_ttl_minutes=resolved_settings.auth_token_ttl_minutes,
        )
        warehouse.ensure_admin_user(
            resolved_settings.admin_username,
            resolved_settings.admin_password,
            auth_service,
        )

        intelligence = LearningIntelligenceService(warehouse)
        intelligence.train_models()
        warehouse.create_warehouse_snapshot()
        knowledge_service = LocalKnowledgeService()
        warehouse.record_event(
            event_type="knowledge_index_refresh",
            source="knowledge_service",
            learner_id=None,
            payload=knowledge_service.get_index_status(),
        )
        agent_service = LocalAgentService(warehouse, intelligence, knowledge_service)
        graph_service = KnowledgeGraphService()
        temporal_model = TemporalLearnerModel(warehouse)
        experimentation_service = ExperimentationService(warehouse)
        planner_service = MissionPlannerService(
            warehouse=warehouse,
            agent_service=agent_service,
            temporal_model=temporal_model,
            graph_service=graph_service,
            experimentation_service=experimentation_service,
        )
        benchmark_service = BenchmarkService(
            warehouse=warehouse,
            knowledge_service=knowledge_service,
            graph_service=graph_service,
            temporal_model=temporal_model,
            planner_service=planner_service,
            experimentation_service=experimentation_service,
        )

        orchestrator = WorkflowOrchestrator(
            settings=resolved_settings,
            warehouse=warehouse,
            intelligence=intelligence,
            benchmark_service=benchmark_service,
        )
        await orchestrator.start()

        app.state.settings = resolved_settings
        app.state.warehouse = warehouse
        app.state.intelligence = intelligence
        app.state.knowledge_service = knowledge_service
        app.state.graph_service = graph_service
        app.state.temporal_model = temporal_model
        app.state.experimentation_service = experimentation_service
        app.state.agent_service = agent_service
        app.state.planner_service = planner_service
        app.state.benchmark_service = benchmark_service
        app.state.auth_service = auth_service
        app.state.orchestrator = orchestrator
        yield
        await orchestrator.shutdown()

    app = FastAPI(
        title=resolved_settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()
