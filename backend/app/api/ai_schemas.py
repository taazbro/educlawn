from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


AIProviderId = Literal["openai", "anthropic", "google", "groq", "mistral", "cohere", "xai"]
AIAuthMode = Literal["user-key", "managed-subscription"]
AITaskCapability = Literal["research", "assignments", "feedback", "planning", "review", "export", "classroom"]


class AIProviderCatalogEntry(BaseModel):
    provider_id: AIProviderId
    label: str
    sdk_package: str
    docs_url: str
    default_model: str
    recommended_models: list[str]
    supports_custom_base_url: bool
    supports_managed_subscription: bool
    notes: str
    sdk_installed: bool
    supported_tasks: list[AITaskCapability]


class AIProviderProfileCreateRequest(BaseModel):
    label: str = Field(min_length=2, max_length=120)
    provider_id: AIProviderId
    auth_mode: AIAuthMode = "user-key"
    api_key: str = Field(min_length=8, max_length=500)
    default_model: str = Field(min_length=2, max_length=120)
    base_url: str = Field(default="", max_length=300)
    capabilities: list[AITaskCapability] = Field(default_factory=list)


class AIProviderProfileUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=2, max_length=120)
    auth_mode: AIAuthMode | None = None
    api_key: str | None = Field(default=None, min_length=8, max_length=500)
    default_model: str | None = Field(default=None, min_length=2, max_length=120)
    base_url: str | None = Field(default=None, max_length=300)
    capabilities: list[AITaskCapability] | None = None


class AIProviderProfileResponse(BaseModel):
    profile_id: str
    label: str
    provider_id: AIProviderId
    provider_label: str
    auth_mode: AIAuthMode
    default_model: str
    base_url: str
    capabilities: list[AITaskCapability]
    api_key_hint: str
    sdk_installed: bool
    last_tested_at: str
    last_test_status: str
    last_error: str
    created_at: str
    updated_at: str


class AIProviderTestResponse(BaseModel):
    used: bool
    generated_at: str
    provider_id: AIProviderId
    provider_label: str
    profile_id: str
    profile_label: str
    auth_mode: AIAuthMode
    model: str
    output_text: str
    error: str


class AIUsageEntry(BaseModel):
    usage_id: str
    source: str
    task: str
    provider_id: AIProviderId
    provider_label: str
    profile_id: str
    profile_label: str
    auth_mode: AIAuthMode
    model: str
    success: bool
    error: str
    prompt_preview: str
    metadata: dict[str, object]
    created_at: str
