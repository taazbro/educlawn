from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.api.educlawn_schemas import (
    EduClawnBootstrapRequest,
    EduClawnBootstrapResponse,
    EduClawnOverviewResponse,
    EduClawnSourceSummaryResponse,
)


router = APIRouter()


@router.get("/api/v1/educlawn/overview", response_model=EduClawnOverviewResponse)
def educlawn_overview(request: Request) -> EduClawnOverviewResponse:
    service = request.app.state.educlawn_service
    return EduClawnOverviewResponse(**service.get_overview())


@router.get("/api/v1/educlawn/source", response_model=EduClawnSourceSummaryResponse)
def educlawn_source(request: Request) -> EduClawnSourceSummaryResponse:
    service = request.app.state.educlawn_service
    return EduClawnSourceSummaryResponse(**service.get_source_summary())


@router.post("/api/v1/educlawn/bootstrap", response_model=EduClawnBootstrapResponse, status_code=status.HTTP_201_CREATED)
def educlawn_bootstrap(payload: EduClawnBootstrapRequest, request: Request) -> EduClawnBootstrapResponse:
    service = request.app.state.educlawn_service
    return EduClawnBootstrapResponse(**service.bootstrap(payload.model_dump()))
