import type {
  AdminStatusResponse,
  AuthTokenResponse,
  BenchmarkReportResponse,
  EducationAgentCatalogEntry,
  EducationAgentRunResponse,
  EducationApproval,
  EducationAuditResponse,
  EducationClassroom,
  EducationLaunchResponse,
  EducationMaterial,
  EducationOverview,
  EducationSafetyStatus,
  EduClawBootstrapResponse,
  EduClawOverview,
  EduClawSourceSummary,
  HealthStatus,
  ProjectDocument,
  ProjectSummary,
  StudioSystemStatus,
  StudioAgentCatalogEntry,
  StudioArtifactBundle,
  StudioCompileResponse,
  StudioGraph,
  StudioOverview,
  StudioProject,
  StudioSearchResult,
  StudioTemplate,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = RequestInit & {
  token?: string
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers = new Headers(init?.headers)
  const isFormData = init?.body instanceof FormData

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (init?.token) {
    headers.set('Authorization', `Bearer ${init.token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response))
  }

  return response.json() as Promise<T>
}

async function readError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = await response.json() as { detail?: string }
    return payload.detail ?? `Request failed: ${response.status}`
  }

  const message = await response.text()
  return message || `Request failed: ${response.status}`
}

export const api = {
  health: () => request<HealthStatus>('/health'),
  login: (payload: { username: string; password: string }) =>
    request<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminStatus: (token: string) =>
    request<AdminStatusResponse>('/api/v1/admin/status', {
      token,
    }),
  latestBenchmark: (token: string) =>
    request<BenchmarkReportResponse>('/api/v1/admin/benchmarks/latest', {
      token,
    }),
  studioOverview: () => request<StudioOverview>('/api/v1/studio/overview'),
  studioSystemStatus: () => request<StudioSystemStatus>('/api/v1/studio/system/status'),
  studioTemplates: () => request<StudioTemplate[]>('/api/v1/studio/templates'),
  studioAgentCatalog: () => request<StudioAgentCatalogEntry[]>('/api/v1/studio/agents/catalog'),
  studioProjects: () => request<ProjectSummary[]>('/api/v1/studio/projects'),
  educationOverview: () => request<EducationOverview>('/api/v1/edu/overview'),
  educationClassrooms: () => request<EducationClassroom[]>('/api/v1/edu/classrooms'),
  educationAgentCatalog: () => request<EducationAgentCatalogEntry[]>('/api/v1/edu/agents/catalog'),
  educationApprovals: (classroomId: string, accessKey: string) =>
    request<EducationApproval[]>(
      `/api/v1/edu/approvals?classroom_id=${encodeURIComponent(classroomId)}&access_key=${encodeURIComponent(accessKey)}`,
    ),
  educationAudit: (classroomId: string, accessKey: string) =>
    request<EducationAuditResponse>(
      `/api/v1/edu/audit?classroom_id=${encodeURIComponent(classroomId)}&access_key=${encodeURIComponent(accessKey)}`,
    ),
  educationSafety: () => request<EducationSafetyStatus>('/api/v1/edu/safety'),
  educlawOverview: () => request<EduClawOverview>('/api/v1/educlaw/overview'),
  educlawSource: () => request<EduClawSourceSummary>('/api/v1/educlaw/source'),
  educlawBootstrap: (payload: {
    school_name: string
    classroom_title: string
    teacher_name: string
    subject: string
    grade_band: string
    description: string
    default_template_id: string
    template_id: string
    assignment_title: string
    assignment_summary: string
    topic: string
    audience: string
    goals: string[]
    rubric: string[]
    standards_focus: string[]
    due_date: string
    local_mode: 'no-llm' | 'local-llm'
  }) =>
    request<EduClawBootstrapResponse>('/api/v1/educlaw/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createClassroom: (payload: {
    title: string
    subject: string
    grade_band: string
    teacher_name: string
    description: string
    default_template_id: string
    standards_focus: string[]
  }) =>
    request<EducationClassroom>('/api/v1/edu/classrooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  enrollStudent: (classroomId: string, payload: {
    name: string
    grade_level: string
    learning_goals: string[]
    notes: string
    access_key: string
  }) =>
    request<EducationClassroom>(`/api/v1/edu/classrooms/${encodeURIComponent(classroomId)}/students`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createAssignment: (classroomId: string, payload: {
    title: string
    summary: string
    topic: string
    audience: string
    template_id: string
    goals: string[]
    rubric: string[]
    standards: string[]
    due_date: string
    local_mode: 'no-llm' | 'local-llm'
    access_key: string
  }) =>
    request<EducationClassroom>(`/api/v1/edu/classrooms/${encodeURIComponent(classroomId)}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uploadClassroomMaterial: (classroomId: string, file: File, accessKey: string, assignmentId = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('access_key', accessKey)
    if (assignmentId) {
      formData.append('assignment_id', assignmentId)
    }
    return request<EducationMaterial>(`/api/v1/edu/classrooms/${encodeURIComponent(classroomId)}/materials`, {
      method: 'POST',
      body: formData,
    })
  },
  launchStudentProject: (classroomId: string, payload: { assignment_id: string; student_id: string; access_key: string }) =>
    request<EducationLaunchResponse>(`/api/v1/edu/classrooms/${encodeURIComponent(classroomId)}/launch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runEducationAgent: (payload: {
    role: 'teacher' | 'student' | 'shared'
    agent_name: string
    classroom_id?: string
    assignment_id?: string
    student_id?: string
    project_slug?: string
    access_key: string
    prompt: string
  }) =>
    request<EducationAgentRunResponse>('/api/v1/edu/agents/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveEducationApproval: (
    approvalId: string,
    payload: { decision: 'approved' | 'rejected'; reviewer: string; note: string; access_key: string },
  ) =>
    request<EducationApproval>(`/api/v1/edu/approvals/${encodeURIComponent(approvalId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createProject: (payload: {
    title: string
    summary: string
    topic: string
    audience: string
    goals: string[]
    rubric: string[]
    template_id: string
    local_mode: 'no-llm' | 'local-llm'
  }) =>
    request<StudioProject>('/api/v1/studio/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  importProject: (file: File, title = '') => {
    const formData = new FormData()
    formData.append('file', file)
    if (title) {
      formData.append('title', title)
    }
    return request<StudioProject>('/api/v1/studio/projects/import', {
      method: 'POST',
      body: formData,
    })
  },
  getProject: (slug: string) =>
    request<StudioProject>(`/api/v1/studio/projects/${encodeURIComponent(slug)}`),
  updateProject: (slug: string, payload: Record<string, unknown>) =>
    request<StudioProject>(`/api/v1/studio/projects/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  cloneProject: (slug: string, title: string) =>
    request<StudioProject>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/clone`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  addTeacherComment: (slug: string, payload: { author: string; body: string; criterion?: string }) =>
    request<StudioProject>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listDocuments: (slug: string) =>
    request<ProjectDocument[]>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/documents`),
  uploadDocument: (slug: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<ProjectDocument>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/documents`, {
      method: 'POST',
      body: formData,
    })
  },
  searchProject: (slug: string, query: string, limit = 6) =>
    request<StudioSearchResult[]>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),
  projectGraph: (slug: string) =>
    request<StudioGraph>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/graph`),
  compileProject: (slug: string, stages?: Array<Record<string, unknown>>) =>
    request<StudioCompileResponse>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/compile`, {
      method: 'POST',
      body: JSON.stringify(stages ? { stages } : {}),
    }),
  projectArtifacts: (slug: string) =>
    request<StudioArtifactBundle>(`/api/v1/studio/projects/${encodeURIComponent(slug)}/artifacts`),
  downloadUrl: (slug: string, exportType: string) =>
    `${API_BASE}/api/v1/studio/projects/${encodeURIComponent(slug)}/download/${encodeURIComponent(exportType)}`,
  legacyUrl: () => `${API_BASE}/legacy`,
}
