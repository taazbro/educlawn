import type {
  AdminAgentBriefingResponse,
  AdminStatusResponse,
  AgentCatalogEntry,
  AgentMemoryResponse,
  AgentRunResponse,
  AuthTokenResponse,
  BenchmarkReportResponse,
  DashboardOverview,
  EvaluationResponse,
  EventPipelineResponse,
  ExperimentMetricsResponse,
  ExperimentRecommendationResponse,
  GraphContextResponse,
  HealthStatus,
  LearnerProfileInput,
  MissionPlanResponse,
  PipelineRefresh,
  PublicAgentName,
  TemporalLearnerState,
  WorkflowName,
  WorkflowRunSummary,
  WorkflowTriggerResponse,
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
  headers.set('Content-Type', 'application/json')

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
  overview: () => request<DashboardOverview>('/api/v1/overview'),
  evaluate: (payload: LearnerProfileInput) =>
    request<EvaluationResponse>('/api/v1/lab/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { username: string; password: string }) =>
    request<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  agentCatalog: () => request<AgentCatalogEntry[]>('/api/v1/agents/catalog'),
  runAgents: (payload: LearnerProfileInput, agentNames?: PublicAgentName[]) =>
    request<AgentRunResponse>('/api/v1/agents/run', {
      method: 'POST',
      body: JSON.stringify({
        profile: payload,
        ...(agentNames ? { agent_names: agentNames } : {}),
      }),
    }),
  agentMemory: (learnerId: string) =>
    request<AgentMemoryResponse>(`/api/v1/agents/memory/${encodeURIComponent(learnerId)}`),
  temporalState: (learnerId: string) =>
    request<TemporalLearnerState>(`/api/v1/temporal/learner/${encodeURIComponent(learnerId)}`),
  graphContext: (sceneFocus: string, predictedPath: string) =>
    request<GraphContextResponse>(
      `/api/v1/graph/context?scene_focus=${encodeURIComponent(sceneFocus)}&predicted_path=${encodeURIComponent(predictedPath)}`,
    ),
  recommendExperiment: (payload: LearnerProfileInput) =>
    request<ExperimentRecommendationResponse>('/api/v1/experiments/recommend', {
      method: 'POST',
      body: JSON.stringify({ profile: payload }),
    }),
  runPlanner: (payload: LearnerProfileInput) =>
    request<MissionPlanResponse>('/api/v1/planner/run', {
      method: 'POST',
      body: JSON.stringify({ profile: payload }),
    }),
  latestPlan: (learnerId: string) =>
    request<MissionPlanResponse>(`/api/v1/planner/latest/${encodeURIComponent(learnerId)}`),
  adminStatus: (token: string) =>
    request<AdminStatusResponse>('/api/v1/admin/status', {
      token,
    }),
  adminAgentBriefing: (token: string) =>
    request<AdminAgentBriefingResponse>('/api/v1/admin/agents/briefing', {
      token,
    }),
  pipelineEvents: (token: string) =>
    request<EventPipelineResponse>('/api/v1/admin/pipeline/events', {
      token,
    }),
  experimentMetrics: (token: string) =>
    request<ExperimentMetricsResponse>('/api/v1/admin/experiments/metrics', {
      token,
    }),
  runBenchmarks: (token: string) =>
    request<BenchmarkReportResponse>('/api/v1/admin/benchmarks/run', {
      method: 'POST',
      token,
    }),
  latestBenchmark: (token: string) =>
    request<BenchmarkReportResponse>('/api/v1/admin/benchmarks/latest', {
      token,
    }),
  workflowRuns: (token: string) =>
    request<WorkflowRunSummary[]>('/api/v1/workflows/runs', {
      token,
    }),
  triggerWorkflow: (token: string, workflowName: WorkflowName) =>
    request<WorkflowTriggerResponse>('/api/v1/workflows/trigger', {
      method: 'POST',
      token,
      body: JSON.stringify({ workflow_name: workflowName }),
    }),
  retrain: (token: string) =>
    request<PipelineRefresh>('/api/v1/pipeline/retrain', {
      method: 'POST',
      token,
    }),
}
