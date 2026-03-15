from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.api.education_schemas import EducationAssignment, EducationClassroomResponse


class EduClawnSourceSummaryResponse(BaseModel):
    available: bool
    path: str
    package_name: str
    version: str
    license: str
    node_requirement: str
    counts: dict[str, int]
    channels: list[str]
    skills: list[str]
    dangerous_tools: list[str]
    key_paths: dict[str, str] | None = None


class EduClawnOverviewResponse(BaseModel):
    product_name: str
    tagline: str
    source_summary: EduClawnSourceSummaryResponse
    product_shape: dict[str, str]
    derived_control_plane: dict[str, Any]
    education_templates: list[dict[str, str]]
    implementation_status: dict[str, bool]


class EduClawnBootstrapRequest(BaseModel):
    school_name: str = Field(min_length=2, max_length=160)
    classroom_title: str = Field(min_length=3, max_length=160)
    teacher_name: str = Field(min_length=2, max_length=120)
    subject: str = Field(min_length=2, max_length=120)
    grade_band: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)
    default_template_id: str = Field(default="lesson-module", min_length=3, max_length=120)
    template_id: str = Field(default="research-portfolio", min_length=3, max_length=120)
    assignment_title: str = Field(default="", max_length=160)
    assignment_summary: str = Field(default="", max_length=400)
    topic: str = Field(default="", max_length=200)
    audience: str = Field(default="", max_length=120)
    goals: list[str] = Field(default_factory=list)
    rubric: list[str] = Field(default_factory=list)
    standards_focus: list[str] = Field(default_factory=list)
    due_date: str = Field(default="", max_length=80)
    local_mode: Literal["no-llm", "local-llm", "provider-ai"] = "no-llm"
    ai_profile_id: str = Field(default="", max_length=120)


class EduClawnControlPlaneResponse(BaseModel):
    version: str
    product: dict[str, Any]
    school: dict[str, Any]
    gateway: dict[str, Any]
    roles: dict[str, Any]
    tools: dict[str, Any]
    skills: dict[str, Any]
    templates: dict[str, Any]
    security: dict[str, Any]


class EduClawnBootstrapResponse(BaseModel):
    classroom: EducationClassroomResponse
    assignment: EducationAssignment
    control_plane: EduClawnControlPlaneResponse
    control_plane_path: str
    attestation_path: str
    source_summary: EduClawnSourceSummaryResponse
