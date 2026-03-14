from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status

from app.api.education_schemas import (
    EducationAgentCatalogEntry,
    EducationAgentRunRequest,
    EducationAgentRunResponse,
    EducationApproval,
    EducationApprovalResolveRequest,
    EducationAuditResponse,
    EducationAssignmentCreateRequest,
    EducationClassroomCreateRequest,
    EducationClassroomResponse,
    EducationLaunchRequest,
    EducationLaunchResponse,
    EducationMaterial,
    EducationOverviewResponse,
    EducationSafetyStatusResponse,
    EducationStudentCreateRequest,
)


router = APIRouter()


@router.get("/api/v1/edu/overview", response_model=EducationOverviewResponse)
def education_overview(request: Request) -> EducationOverviewResponse:
    service = request.app.state.education_service
    return EducationOverviewResponse(**service.get_overview())


@router.get("/api/v1/edu/classrooms", response_model=list[EducationClassroomResponse])
def list_classrooms(request: Request) -> list[EducationClassroomResponse]:
    service = request.app.state.education_service
    return [EducationClassroomResponse(**item) for item in service.list_classrooms()]


@router.post("/api/v1/edu/classrooms", response_model=EducationClassroomResponse, status_code=status.HTTP_201_CREATED)
def create_classroom(payload: EducationClassroomCreateRequest, request: Request) -> EducationClassroomResponse:
    service = request.app.state.education_service
    classroom = service.create_classroom(payload.model_dump())
    return EducationClassroomResponse(**classroom)


@router.get("/api/v1/edu/classrooms/{classroom_id}", response_model=EducationClassroomResponse)
def get_classroom(classroom_id: str, request: Request) -> EducationClassroomResponse:
    service = request.app.state.education_service
    try:
        classroom = service.get_classroom(classroom_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classroom not found.") from error
    return EducationClassroomResponse(**classroom)


@router.post("/api/v1/edu/classrooms/{classroom_id}/students", response_model=EducationClassroomResponse)
def enroll_student(
    classroom_id: str,
    payload: EducationStudentCreateRequest,
    request: Request,
) -> EducationClassroomResponse:
    service = request.app.state.education_service
    try:
        classroom = service.enroll_student(classroom_id, payload.model_dump())
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classroom not found.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationClassroomResponse(**classroom)


@router.post("/api/v1/edu/classrooms/{classroom_id}/assignments", response_model=EducationClassroomResponse)
def create_assignment(
    classroom_id: str,
    payload: EducationAssignmentCreateRequest,
    request: Request,
) -> EducationClassroomResponse:
    service = request.app.state.education_service
    try:
        classroom = service.create_assignment(classroom_id, payload.model_dump())
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classroom or template not found.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationClassroomResponse(**classroom)


@router.post("/api/v1/edu/classrooms/{classroom_id}/materials", response_model=EducationMaterial)
async def upload_classroom_material(
    classroom_id: str,
    request: Request,
    file: UploadFile = File(...),
    assignment_id: str | None = Form(default=None),
    access_key: str = Form(...),
) -> EducationMaterial:
    service = request.app.state.education_service
    try:
        material = service.add_material(
            classroom_id=classroom_id,
            filename=file.filename or "upload.bin",
            content=await file.read(),
            content_type=file.content_type,
            assignment_id=assignment_id,
            access_key=access_key,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classroom or assignment not found.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationMaterial(**material)


@router.post("/api/v1/edu/classrooms/{classroom_id}/launch", response_model=EducationLaunchResponse)
def launch_student_project(
    classroom_id: str,
    payload: EducationLaunchRequest,
    request: Request,
) -> EducationLaunchResponse:
    service = request.app.state.education_service
    try:
        result = service.launch_student_project(classroom_id, payload.assignment_id, payload.student_id, payload.access_key)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classroom, assignment, or student not found.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationLaunchResponse(**result)


@router.get("/api/v1/edu/agents/catalog", response_model=list[EducationAgentCatalogEntry])
def education_agent_catalog(request: Request) -> list[EducationAgentCatalogEntry]:
    service = request.app.state.education_service
    return [EducationAgentCatalogEntry(**item) for item in service.catalog()]


@router.post("/api/v1/edu/agents/run", response_model=EducationAgentRunResponse)
def run_education_agent(payload: EducationAgentRunRequest, request: Request) -> EducationAgentRunResponse:
    service = request.app.state.education_service
    try:
        result = service.run_agent(payload.model_dump(exclude_none=True))
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationAgentRunResponse(**result)


@router.get("/api/v1/edu/approvals", response_model=list[EducationApproval])
def list_approvals(
    request: Request,
    classroom_id: str = Query(..., min_length=3),
    access_key: str = Query(..., min_length=8),
) -> list[EducationApproval]:
    service = request.app.state.education_service
    try:
        approvals = service.list_approvals(classroom_id=classroom_id, access_key=access_key)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return [EducationApproval(**item) for item in approvals]


@router.post("/api/v1/edu/approvals/{approval_id}/resolve", response_model=EducationApproval)
def resolve_approval(
    approval_id: str,
    payload: EducationApprovalResolveRequest,
    request: Request,
) -> EducationApproval:
    service = request.app.state.education_service
    try:
        approval = service.resolve_approval(approval_id, payload.model_dump())
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Approval not found.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationApproval(**approval)


@router.get("/api/v1/edu/audit", response_model=EducationAuditResponse)
def audit_log(
    request: Request,
    classroom_id: str = Query(..., min_length=3),
    access_key: str = Query(..., min_length=8),
) -> EducationAuditResponse:
    service = request.app.state.education_service
    try:
        entries = service.list_audit_entries(classroom_id=classroom_id, access_key=access_key)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return EducationAuditResponse(entries=entries)


@router.get("/api/v1/edu/safety", response_model=EducationSafetyStatusResponse)
def safety_status(request: Request) -> EducationSafetyStatusResponse:
    service = request.app.state.education_service
    return EducationSafetyStatusResponse(**service.get_safety_status())
