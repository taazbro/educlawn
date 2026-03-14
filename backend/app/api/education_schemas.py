from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.api.studio_schemas import StudioProjectResponse


EducationRole = Literal["teacher", "student", "shared"]
EducationAgentName = Literal[
    "lesson-planner",
    "rubric-designer",
    "feedback-coach",
    "classroom-analyst",
    "project-coach",
    "research-coach",
    "citation-tutor",
    "revision-tutor",
    "study-planner",
    "approval-guard",
    "audit-reporter",
    "evidence-librarian",
]


class EducationRoleModel(BaseModel):
    role: EducationRole
    label: str
    description: str
    agent_names: list[str]


class EducationTemplateTrack(BaseModel):
    id: str
    label: str
    project_type: str
    category: str


class EducationOverviewResponse(BaseModel):
    product_name: str
    positioning: str
    difference_statement: str
    role_models: list[EducationRoleModel]
    safety_model: dict[str, Any]
    counts: dict[str, int]
    agent_catalog: list[dict[str, Any]]
    template_tracks: list[EducationTemplateTrack]


class EducationSecurityBootstrap(BaseModel):
    teacher_access_key: str
    student_access_key: str
    reviewer_access_key: str
    issued_at: str
    rotation_note: str


class EducationSecurityPosture(BaseModel):
    policy_version: str
    protected: bool
    max_material_bytes: int
    allowed_content_types: list[str]
    audit_chain_valid: bool
    approval_chain_valid: bool


class EducationStudent(BaseModel):
    student_id: str
    name: str
    grade_level: str
    learning_goals: list[str]
    notes: str
    project_slugs: list[str]
    created_at: str
    updated_at: str


class EducationLaunchedProject(BaseModel):
    student_id: str
    student_name: str
    project_slug: str
    project_title: str
    created_at: str


class EducationAssignment(BaseModel):
    assignment_id: str
    title: str
    summary: str
    topic: str
    audience: str
    template_id: str
    template_label: str
    goals: list[str]
    rubric: list[str]
    standards: list[str]
    due_date: str
    local_mode: Literal["no-llm", "local-llm"]
    status: str
    created_at: str
    updated_at: str
    evidence_material_ids: list[str]
    launched_projects: list[EducationLaunchedProject]


class EducationMaterial(BaseModel):
    material_id: str
    title: str
    file_name: str
    content_type: str
    source_path: str
    summary: str
    word_count: int
    assignment_id: str | None = None
    scope: Literal["shared", "assignment"]
    extraction_method: str
    uploaded_at: str


class EducationClassroomResponse(BaseModel):
    version: str
    classroom_id: str
    title: str
    subject: str
    grade_band: str
    teacher_name: str
    description: str
    default_template_id: str
    standards_focus: list[str]
    safety_mode: str
    created_at: str
    updated_at: str
    students: list[EducationStudent]
    assignments: list[EducationAssignment]
    evidence_library: list[EducationMaterial]
    shared_layer: dict[str, Any]
    security_posture: EducationSecurityPosture | None = None
    security_bootstrap: EducationSecurityBootstrap | None = None
    student_count: int
    assignment_count: int
    evidence_count: int
    project_count: int


class EducationClassroomCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    subject: str = Field(min_length=2, max_length=120)
    grade_band: str = Field(min_length=2, max_length=80)
    teacher_name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    default_template_id: str = Field(default="lesson-module", min_length=3, max_length=120)
    standards_focus: list[str] = Field(default_factory=list)


class EducationStudentCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    grade_level: str = Field(default="", max_length=80)
    learning_goals: list[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=500)
    access_key: str = Field(min_length=8, max_length=200)


class EducationAssignmentCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    summary: str = Field(default="", max_length=400)
    topic: str = Field(min_length=3, max_length=200)
    audience: str = Field(default="", max_length=120)
    template_id: str = Field(default="lesson-module", min_length=3, max_length=120)
    goals: list[str] = Field(default_factory=list)
    rubric: list[str] = Field(default_factory=list)
    standards: list[str] = Field(default_factory=list)
    due_date: str = Field(default="", max_length=80)
    local_mode: Literal["no-llm", "local-llm"] = "no-llm"
    access_key: str = Field(min_length=8, max_length=200)


class EducationLaunchRequest(BaseModel):
    assignment_id: str = Field(min_length=3, max_length=120)
    student_id: str = Field(min_length=3, max_length=120)
    access_key: str = Field(min_length=8, max_length=200)


class EducationLaunchResponse(BaseModel):
    classroom: EducationClassroomResponse
    project: StudioProjectResponse
    seeded_material_count: int


class EducationAgentCatalogEntry(BaseModel):
    name: EducationAgentName
    display_name: str
    role: EducationRole
    description: str
    allowed_tool_scopes: list[str]
    artifact_types: list[str]


class EducationAgentRunRequest(BaseModel):
    role: EducationRole
    agent_name: EducationAgentName
    classroom_id: str | None = None
    assignment_id: str | None = None
    student_id: str | None = None
    project_slug: str | None = None
    access_key: str = Field(min_length=8, max_length=200)
    prompt: str = Field(default="", max_length=1600)


class EducationRiskAssessment(BaseModel):
    score: int
    band: Literal["low", "moderate", "high", "critical"]
    signals: list[str]
    policy_actions: list[str]
    redacted_excerpt: str


class EducationApproval(BaseModel):
    approval_id: str
    status: Literal["pending", "approved", "rejected"]
    requested_at: str
    reviewed_at: str | None = None
    reviewer: str
    note: str
    agent_name: str
    role: str
    classroom_id: str | None = None
    assignment_id: str | None = None
    student_id: str | None = None
    project_slug: str | None = None
    requested_actions: list[str]
    prompt_excerpt: str
    rationale: str
    risk_assessment: EducationRiskAssessment | None = None
    prev_hash: str | None = None
    entry_hash: str | None = None


class EducationAuditEntry(BaseModel):
    audit_id: str
    created_at: str
    actor_role: str
    agent_name: str
    action: str
    summary: str
    classroom_id: str | None = None
    assignment_id: str | None = None
    student_id: str | None = None
    project_slug: str | None = None
    allowed_actions: list[str]
    sensitive_actions_requested: list[str]
    status: str
    prompt_excerpt: str | None = None
    risk_assessment: EducationRiskAssessment | None = None
    prev_hash: str | None = None
    entry_hash: str | None = None


class EducationAgentRunResponse(BaseModel):
    run_id: str
    agent_name: str
    display_name: str
    role: str
    summary: str
    allowed_actions: list[str]
    blocked_capabilities: list[str]
    requires_approval: bool
    sensitive_actions_requested: list[str]
    risk_assessment: EducationRiskAssessment
    approval_request: EducationApproval | None = None
    artifacts: dict[str, Any]
    audit_entry: EducationAuditEntry


class EducationApprovalResolveRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    reviewer: str = Field(min_length=2, max_length=120)
    note: str = Field(default="", max_length=500)
    access_key: str = Field(min_length=8, max_length=200)


class EducationAuditResponse(BaseModel):
    entries: list[EducationAuditEntry]


class EducationSafetyStatusResponse(BaseModel):
    policy_name: str
    mode: str
    approval_required_for: list[str]
    blocked_capabilities: list[str]
    role_policies: list[EducationRoleModel]
    allowed_tool_scopes: list[str]
    pending_approvals: int
    audit_entries: int
    last_audit_entries: list[EducationAuditEntry]
    audit_chain_valid: bool
    approval_chain_valid: bool
    material_policy: dict[str, Any]
