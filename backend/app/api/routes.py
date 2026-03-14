from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.schemas import (
    AdminStatusResponse,
    AdminAgentBriefingResponse,
    AgentCatalogEntry,
    AgentMemoryResponse,
    AgentRunRequest,
    AgentRunResponse,
    BenchmarkReportResponse,
    EventPipelineResponse,
    ExperimentMetricsResponse,
    ExperimentRecommendationRequest,
    ExperimentRecommendationResponse,
    GraphContextResponse,
    MissionPlanRequest,
    MissionPlanResponse,
    TemporalLearnerStateResponse,
    AuthLoginRequest,
    AuthTokenResponse,
    LearnerProfile,
    PipelineRefreshResponse,
    WorkflowRunSummary,
    WorkflowTriggerRequest,
    WorkflowTriggerResponse,
)


router = APIRouter()
bearer = HTTPBearer(auto_error=False)


def _services(request: Request):
    return (
        request.app.state.warehouse,
        request.app.state.intelligence,
        request.app.state.auth_service,
        request.app.state.orchestrator,
        request.app.state.settings,
    )


def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    auth_service = request.app.state.auth_service
    try:
        claims = auth_service.decode_token(credentials.credentials)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error

    if claims.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.")

    return claims


@router.get("/health")
def healthcheck(request: Request) -> dict[str, object]:
    intelligence = request.app.state.intelligence
    settings = request.app.state.settings
    orchestrator = request.app.state.orchestrator
    return {
        "status": "ok",
        "app": settings.app_name,
        "trained": bool(intelligence.path_pipeline and intelligence.risk_pipeline),
        "trained_at": intelligence.trained_at,
        "database_backend": settings.database_backend,
        "scheduler": orchestrator.get_scheduler_status(),
    }


@router.post("/api/v1/auth/login", response_model=AuthTokenResponse)
def login(payload: AuthLoginRequest, request: Request) -> AuthTokenResponse:
    warehouse, _, auth_service, _, _ = _services(request)
    user = warehouse.get_user_by_username(payload.username)
    if user is None or not auth_service.verify_password(payload.password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    return AuthTokenResponse(**auth_service.issue_token(user["username"], user["role"]))


@router.get("/legacy")
def open_legacy_experience(request: Request) -> FileResponse:
    legacy_html = request.app.state.settings.legacy_html_path
    if not legacy_html.exists():
        raise HTTPException(status_code=404, detail="Legacy experience not found.")
    return FileResponse(legacy_html)


@router.get("/api/v1/overview")
def get_overview(request: Request) -> dict[str, object]:
    warehouse, intelligence, _, _, _ = _services(request)
    payload = warehouse.get_dashboard_snapshot()
    payload["model_summary"] = intelligence.get_model_summary()
    return payload


@router.get("/api/v1/sessions")
def get_recent_sessions(request: Request) -> list[dict[str, object]]:
    warehouse, _, _, _, _ = _services(request)
    return warehouse.get_dashboard_snapshot()["recent_sessions"]


@router.post("/api/v1/lab/evaluate")
def evaluate_profile(profile: LearnerProfile, request: Request) -> dict[str, object]:
    warehouse, intelligence, _, _, _ = _services(request)
    result = intelligence.evaluate_profile(profile)
    evaluation_id = warehouse.persist_live_evaluation(profile, result)
    refreshed_summary = intelligence.train_models()
    return {
        **result,
        "evaluation_id": evaluation_id,
        "model_summary": refreshed_summary,
    }


@router.get("/api/v1/model")
def model_summary(request: Request) -> dict[str, object]:
    _, intelligence, _, _, _ = _services(request)
    return intelligence.get_model_summary()


@router.get("/api/v1/temporal/learner/{learner_id}", response_model=TemporalLearnerStateResponse)
def temporal_state(learner_id: str, request: Request) -> TemporalLearnerStateResponse:
    warehouse, _, _, _, _ = _services(request)
    sessions = warehouse.fetch_recent_learner_sessions(learner_id, limit=1)
    if not sessions:
        raise HTTPException(status_code=404, detail="Learner history not found.")

    latest = sessions[0]
    state = request.app.state.temporal_model.build_state(
        learner_id=learner_id,
        current_evaluation={
            "predicted_path": latest["recommended_path"],
            "risk_band": latest["engagement_risk"],
        },
        current_profile={
            "hope": latest["hope"],
            "courage": latest["courage"],
            "wisdom": latest["wisdom"],
            "leadership": latest["leadership"],
            "questions_answered": latest["questions_answered"],
            "accuracy_rate": latest["accuracy_rate"],
            "historical_alignment": latest["historical_alignment"],
            "minutes_spent": latest["minutes_spent"],
            "achievement_count": latest["achievement_count"],
            "nonviolent_choices": latest["nonviolent_choices"],
            "total_choices": latest["total_choices"],
        },
    )
    return TemporalLearnerStateResponse(**state)


@router.get("/api/v1/graph/context", response_model=GraphContextResponse)
def graph_context(
    request: Request,
    scene_focus: str = Query(..., min_length=3),
    predicted_path: str = Query(..., min_length=3),
) -> GraphContextResponse:
    graph_service = request.app.state.graph_service
    return GraphContextResponse(**graph_service.get_context(scene_focus, predicted_path))


@router.get("/api/v1/agents/catalog", response_model=list[AgentCatalogEntry])
def agent_catalog(request: Request) -> list[AgentCatalogEntry]:
    catalog = request.app.state.agent_service.get_catalog()
    return [AgentCatalogEntry(**entry) for entry in catalog]


@router.post("/api/v1/agents/run", response_model=AgentRunResponse)
def run_agents(payload: AgentRunRequest, request: Request) -> AgentRunResponse:
    agent_service = request.app.state.agent_service
    try:
        result = agent_service.run_profile_agents(payload.profile, payload.agent_names)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return AgentRunResponse(**result)


@router.get("/api/v1/agents/memory/{learner_id}", response_model=AgentMemoryResponse)
def agent_memory(learner_id: str, request: Request) -> AgentMemoryResponse:
    agent_service = request.app.state.agent_service
    memory = agent_service.get_agent_memory(learner_id)
    return AgentMemoryResponse(**memory)


@router.post("/api/v1/experiments/recommend", response_model=ExperimentRecommendationResponse)
def recommend_experiment(
    payload: ExperimentRecommendationRequest,
    request: Request,
) -> ExperimentRecommendationResponse:
    intelligence = request.app.state.intelligence
    temporal_model = request.app.state.temporal_model
    experimentation_service = request.app.state.experimentation_service
    evaluation = intelligence.evaluate_profile(payload.profile)
    temporal_state = temporal_model.build_state(payload.profile.learner_id, evaluation, payload.profile.model_dump())
    recommendation = experimentation_service.recommend(payload.profile.learner_id, evaluation, temporal_state)
    return ExperimentRecommendationResponse(**recommendation)


@router.post("/api/v1/planner/run", response_model=MissionPlanResponse)
def run_planner(payload: MissionPlanRequest, request: Request) -> MissionPlanResponse:
    planner_service = request.app.state.planner_service
    plan = planner_service.generate_plan(payload.profile)
    return MissionPlanResponse(**plan)


@router.get("/api/v1/planner/latest/{learner_id}", response_model=MissionPlanResponse)
def latest_plan(learner_id: str, request: Request) -> MissionPlanResponse:
    planner_service = request.app.state.planner_service
    plan = planner_service.get_latest_plan(learner_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Mission plan not found.")
    return MissionPlanResponse(**plan)


@router.get("/api/v1/admin/status", response_model=AdminStatusResponse)
def admin_status(request: Request, admin_user: dict[str, Any] = Depends(require_admin)) -> AdminStatusResponse:
    warehouse, intelligence, _, orchestrator, settings = _services(request)
    return AdminStatusResponse(
        database_backend=settings.database_backend,
        database_url=settings.database_url,
        latest_snapshot=warehouse.get_latest_snapshot(),
        scheduler=orchestrator.get_scheduler_status(),
        model_summary=intelligence.get_model_summary(),
        current_user={"username": str(admin_user["sub"]), "role": str(admin_user["role"])},
    )


@router.get("/api/v1/admin/pipeline/events", response_model=EventPipelineResponse)
def admin_pipeline_events(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> EventPipelineResponse:
    warehouse, _, _, _, _ = _services(request)
    return EventPipelineResponse(**warehouse.fetch_event_pipeline(limit=20))


@router.get("/api/v1/admin/experiments/metrics", response_model=ExperimentMetricsResponse)
def admin_experiment_metrics(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> ExperimentMetricsResponse:
    experimentation_service = request.app.state.experimentation_service
    return ExperimentMetricsResponse(**experimentation_service.get_metrics())


@router.get("/api/v1/admin/agents/briefing", response_model=AdminAgentBriefingResponse)
def admin_agent_briefing(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> AdminAgentBriefingResponse:
    warehouse, intelligence, _, orchestrator, _ = _services(request)
    agent_service = request.app.state.agent_service
    briefing = agent_service.build_admin_briefing(
        latest_snapshot=warehouse.get_latest_snapshot(),
        workflow_runs=warehouse.fetch_workflow_runs(limit=5),
        scheduler_status=orchestrator.get_scheduler_status(),
        model_summary=intelligence.get_model_summary(),
    )
    return AdminAgentBriefingResponse(**briefing)


@router.post("/api/v1/admin/benchmarks/run", response_model=BenchmarkReportResponse)
def admin_benchmarks(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> BenchmarkReportResponse:
    benchmark_service = request.app.state.benchmark_service
    return BenchmarkReportResponse(**benchmark_service.run())


@router.get("/api/v1/admin/benchmarks/latest", response_model=BenchmarkReportResponse)
def admin_latest_benchmark(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> BenchmarkReportResponse:
    warehouse, _, _, _, _ = _services(request)
    report = warehouse.get_latest_benchmark_report()
    if report is None:
        raise HTTPException(status_code=404, detail="Benchmark report not found.")
    return BenchmarkReportResponse(**report)


@router.get("/api/v1/workflows/runs", response_model=list[WorkflowRunSummary])
def workflow_runs_endpoint(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> list[WorkflowRunSummary]:
    warehouse, _, _, _, _ = _services(request)
    runs = warehouse.fetch_workflow_runs(limit=20)
    return [WorkflowRunSummary(**run) for run in runs]


@router.post("/api/v1/workflows/trigger", response_model=WorkflowTriggerResponse)
async def trigger_workflow(
    payload: WorkflowTriggerRequest,
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> WorkflowTriggerResponse:
    _, _, _, orchestrator, _ = _services(request)
    result = await orchestrator.run_workflow(
        payload.workflow_name,
        trigger="manual",
        actor=str(admin_user["sub"]),
    )
    return WorkflowTriggerResponse(**result)


@router.post("/api/v1/pipeline/retrain", response_model=PipelineRefreshResponse)
async def retrain_pipeline(
    request: Request,
    admin_user: dict[str, Any] = Depends(require_admin),
) -> PipelineRefreshResponse:
    _, _, _, orchestrator, _ = _services(request)
    refreshed = await orchestrator.run_workflow("model_retrain", trigger="manual", actor=str(admin_user["sub"]))
    details = refreshed["details"]
    return PipelineRefreshResponse(
        training_rows=int(details["training_rows"]),
        trained_at=str(details["trained_at"]),
    )
