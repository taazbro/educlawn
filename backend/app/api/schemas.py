from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LearnerProfile(BaseModel):
    learner_id: str = Field(default="live-learner", min_length=3, max_length=64)
    hope: int = Field(default=68, ge=0, le=100)
    courage: int = Field(default=62, ge=0, le=100)
    wisdom: int = Field(default=74, ge=0, le=100)
    leadership: int = Field(default=70, ge=0, le=100)
    questions_answered: int = Field(default=14, ge=0, le=500)
    accuracy_rate: float = Field(default=82, ge=0, le=100)
    historical_alignment: float = Field(default=88, ge=0, le=100)
    minutes_spent: float = Field(default=42, gt=0, le=600)
    achievement_count: int = Field(default=5, ge=0, le=100)
    nonviolent_choices: int = Field(default=9, ge=0, le=100)
    total_choices: int = Field(default=11, ge=1, le=100)


class AuthLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_at: str
    username: str
    role: str


class PipelineRefreshResponse(BaseModel):
    training_rows: int
    trained_at: str


class WorkflowTriggerRequest(BaseModel):
    workflow_name: Literal["etl_snapshot", "model_retrain", "full_refresh", "benchmark_suite"]


class WorkflowTriggerResponse(BaseModel):
    workflow_name: str
    trigger: str
    status: str
    details: dict[str, object]


class WorkflowRunSummary(BaseModel):
    workflow_name: str
    trigger: str
    status: str
    actor: str
    rows_processed: int
    started_at: str
    finished_at: str | None = None
    duration_ms: int | None = None
    message: str | None = None
    details_json: str | None = None


class SchedulerStatus(BaseModel):
    enabled: bool
    etl_interval_seconds: int
    retrain_interval_seconds: int
    benchmark_interval_seconds: int
    active_tasks: int


class AdminStatusResponse(BaseModel):
    database_backend: str
    database_url: str
    latest_snapshot: dict[str, object] | None = None
    scheduler: SchedulerStatus
    model_summary: dict[str, object]
    current_user: dict[str, str]


AgentName = Literal["mentor", "strategist", "historian", "operations", "planner"]
PublicAgentName = Literal["mentor", "strategist", "historian"]


class AgentCatalogEntry(BaseModel):
    name: AgentName
    display_name: str
    role: str
    description: str
    requires_admin: bool


class AgentInsight(BaseModel):
    agent_name: AgentName
    display_name: str
    role: str
    summary: str
    confidence: float = Field(ge=0, le=100)
    priority: Literal["low", "medium", "high"]
    signals: list[str]
    actions: list[str]


class AgentEvaluationSnapshot(BaseModel):
    predicted_path: str
    risk_band: str
    confidence: float
    cohort_label: str
    suggested_scene_focus: str


class KnowledgeDocument(BaseModel):
    document_id: str
    title: str
    era: str
    theme: str
    relevance: float = Field(ge=0, le=100)
    summary: str
    teaching_use: str


class AgentMemorySummary(BaseModel):
    learner_id: str
    run_count: int
    last_path: str | None = None
    last_risk: str | None = None
    dominant_agent: AgentName | None = None
    last_run_at: str | None = None


class AgentMemoryEntry(BaseModel):
    learner_id: str
    agent_name: AgentName
    display_name: str
    priority: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0, le=100)
    summary: str
    predicted_path: str
    risk_band: str
    scene_focus: str
    knowledge_document_ids: list[str]
    created_at: str


class AgentMemoryResponse(BaseModel):
    summary: AgentMemorySummary
    timeline: list[AgentMemoryEntry]


class AgentRunRequest(BaseModel):
    profile: LearnerProfile
    agent_names: list[PublicAgentName] | None = None


class AgentRunResponse(BaseModel):
    generated_at: str
    evaluation: AgentEvaluationSnapshot
    agents: list[AgentInsight]
    knowledge_matches: list[KnowledgeDocument]
    memory: AgentMemoryResponse


class AdminAgentBriefingResponse(BaseModel):
    generated_at: str
    operations_agent: AgentInsight


class TemporalLearnerStateResponse(BaseModel):
    learner_id: str
    session_count: int
    average_mastery: float
    average_accuracy: float
    mastery_velocity: float
    accuracy_velocity: float
    risk_stability: float
    path_consistency: float
    intervention_effectiveness: float
    momentum_label: str
    recommended_intensity: str
    current_path: str
    current_risk: str
    narrative: str


class GraphNode(BaseModel):
    id: str
    label: str
    node_type: str


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str


class GraphContextResponse(BaseModel):
    scene_focus: str
    predicted_path: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    highlights: list[str]


class ExperimentRecommendationRequest(BaseModel):
    profile: LearnerProfile


class ExperimentRecommendationResponse(BaseModel):
    assignment_id: int
    learner_id: str
    policy_name: str
    policy_label: str
    rationale: str
    estimated_lift: float
    exploration_score: float
    exploitation_score: float
    assigned_at: str


class ExperimentPolicyMetrics(BaseModel):
    policy_name: str
    policy_label: str
    assignment_count: int
    average_estimated_lift: float


class ExperimentMetricsResponse(BaseModel):
    total_assignments: int
    policies: list[ExperimentPolicyMetrics]


class EventTypeCount(BaseModel):
    event_type: str
    count: int


class EventRecord(BaseModel):
    event_type: str
    source: str
    learner_id: str | None = None
    created_at: str
    payload_preview: str


class EventPipelineResponse(BaseModel):
    total_events: int
    latest_event_at: str | None = None
    event_types: list[EventTypeCount]
    recent_events: list[EventRecord]


class MissionStep(BaseModel):
    step_number: int
    title: str
    purpose: str
    recommended_agent: AgentName
    duration_minutes: int
    success_signal: str
    resources: list[str]


class MissionCheckpoint(BaseModel):
    name: str
    description: str
    metric: str


class MissionBranch(BaseModel):
    condition: str
    fallback_step: str


class MissionPlanRequest(BaseModel):
    profile: LearnerProfile


class MissionPlanResponse(BaseModel):
    plan_id: int
    learner_id: str
    generated_at: str
    mission_title: str
    objective: str
    target_path: str
    target_scene: str
    planner_agent: AgentInsight
    supporting_agents: list[AgentInsight]
    temporal_state: TemporalLearnerStateResponse
    experiment_policy: ExperimentRecommendationResponse
    knowledge_matches: list[KnowledgeDocument]
    graph_context: GraphContextResponse
    steps: list[MissionStep]
    checkpoints: list[MissionCheckpoint]
    branches: list[MissionBranch]
    completion_criteria: list[str]


class BenchmarkScore(BaseModel):
    benchmark_name: str
    score: float
    status: Literal["pass", "warn", "fail"]
    summary: str


class BenchmarkReportResponse(BaseModel):
    generated_at: str
    overall_score: float
    benchmarks: list[BenchmarkScore]
    recommendations: list[str]
