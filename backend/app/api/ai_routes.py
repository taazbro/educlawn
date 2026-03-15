from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.api.ai_schemas import (
    AIProviderCatalogEntry,
    AIProviderProfileCreateRequest,
    AIProviderProfileResponse,
    AIProviderProfileUpdateRequest,
    AIProviderTestResponse,
    AIUsageEntry,
)


router = APIRouter()


@router.get("/api/v1/ai/catalog", response_model=list[AIProviderCatalogEntry])
def ai_provider_catalog(request: Request) -> list[AIProviderCatalogEntry]:
    service = request.app.state.ai_provider_service
    return [AIProviderCatalogEntry(**entry) for entry in service.provider_catalog()]


@router.get("/api/v1/ai/profiles", response_model=list[AIProviderProfileResponse])
def ai_profiles(request: Request) -> list[AIProviderProfileResponse]:
    service = request.app.state.ai_provider_service
    return [AIProviderProfileResponse(**entry) for entry in service.list_profiles()]


@router.post("/api/v1/ai/profiles", response_model=AIProviderProfileResponse, status_code=status.HTTP_201_CREATED)
def create_ai_profile(payload: AIProviderProfileCreateRequest, request: Request) -> AIProviderProfileResponse:
    service = request.app.state.ai_provider_service
    try:
        profile = service.create_profile(payload.model_dump())
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return AIProviderProfileResponse(**profile)


@router.put("/api/v1/ai/profiles/{profile_id}", response_model=AIProviderProfileResponse)
def update_ai_profile(profile_id: str, payload: AIProviderProfileUpdateRequest, request: Request) -> AIProviderProfileResponse:
    service = request.app.state.ai_provider_service
    try:
        profile = service.update_profile(profile_id, payload.model_dump(exclude_none=True))
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="AI profile not found.") from error
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return AIProviderProfileResponse(**profile)


@router.delete("/api/v1/ai/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_profile(profile_id: str, request: Request) -> None:
    service = request.app.state.ai_provider_service
    try:
        service.delete_profile(profile_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="AI profile not found.") from error


@router.post("/api/v1/ai/profiles/{profile_id}/test", response_model=AIProviderTestResponse)
def test_ai_profile(profile_id: str, request: Request) -> AIProviderTestResponse:
    service = request.app.state.ai_provider_service
    try:
        result = service.test_profile(profile_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="AI profile not found.") from error
    return AIProviderTestResponse(**result)


@router.get("/api/v1/ai/usage", response_model=list[AIUsageEntry])
def recent_ai_usage(request: Request, limit: int = 25) -> list[AIUsageEntry]:
    service = request.app.state.ai_provider_service
    return [AIUsageEntry(**entry) for entry in service.recent_usage(limit=limit)]
