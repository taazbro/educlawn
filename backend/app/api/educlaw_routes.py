from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.api.educlaw_schemas import (
    EduClawBootstrapRequest,
    EduClawBootstrapResponse,
    EduClawOverviewResponse,
    EduClawSourceSummaryResponse,
)


router = APIRouter()


@router.get("/api/v1/educlaw/overview", response_model=EduClawOverviewResponse)
def educlaw_overview(request: Request) -> EduClawOverviewResponse:
    service = request.app.state.educlaw_service
    return EduClawOverviewResponse(**service.get_overview())


@router.get("/api/v1/educlaw/source", response_model=EduClawSourceSummaryResponse)
def educlaw_source(request: Request) -> EduClawSourceSummaryResponse:
    service = request.app.state.educlaw_service
    return EduClawSourceSummaryResponse(**service.get_source_summary())


@router.post("/api/v1/educlaw/bootstrap", response_model=EduClawBootstrapResponse, status_code=status.HTTP_201_CREATED)
def educlaw_bootstrap(payload: EduClawBootstrapRequest, request: Request) -> EduClawBootstrapResponse:
    service = request.app.state.educlaw_service
    return EduClawBootstrapResponse(**service.bootstrap(payload.model_dump()))
