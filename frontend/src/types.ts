export type SchedulerStatus = {
  enabled: boolean
  etl_interval_seconds: number
  retrain_interval_seconds: number
  benchmark_interval_seconds: number
  active_tasks: number
}

export type HealthStatus = {
  status: string
  app: string
  trained: boolean
  trained_at: string
  database_backend: string
  scheduler: SchedulerStatus
}

export type DistributionPoint = {
  label: string
  count: number
  share: number
}

export type ProbabilityPoint = {
  label: string
  score: number
}

export type TrendPoint = {
  day: string
  mastery: number
  accuracy: number
  support_need: number
}

export type CohortSegment = {
  segment: string
  learner_count: number
  avg_mastery: number
  avg_accuracy: number
  avg_time: number
}

export type RecentSession = {
  learner_label: string
  narrative_focus: string
  engagement_risk: string
  mastery_index: number
  accuracy_rate: number
  created_at: string
}

export type SnapshotSummary = {
  id?: number
  snapshot_id?: number
  snapshot_at: string
  learner_count: number
  average_mastery: number
  average_accuracy: number
  high_risk_share: number
  rows_processed?: number
  details: Record<string, string | number | boolean | null>
}

export type ModelSummary = {
  trained: boolean
  trained_at: string
  training_rows: number
  path_classes: string[]
  risk_classes: string[]
  top_features: Array<{
    feature: string
    importance: number
  }>
}

export type DashboardOverview = {
  headline_metrics: {
    learners_total: number
    average_mastery: number
    average_accuracy: number
    average_time_minutes: number
    high_risk_share: number
    policy_ready_share: number
  }
  path_distribution: DistributionPoint[]
  risk_distribution: DistributionPoint[]
  weekly_mastery_trend: TrendPoint[]
  cohort_segments: CohortSegment[]
  recent_sessions: RecentSession[]
  recent_predictions: Array<{
    learner_label: string
    created_at: string
  }>
  latest_snapshot: SnapshotSummary | null
  legacy_url: string
  model_summary: ModelSummary
}

export type LearnerProfileInput = {
  learner_id: string
  hope: number
  courage: number
  wisdom: number
  leadership: number
  questions_answered: number
  accuracy_rate: number
  historical_alignment: number
  minutes_spent: number
  achievement_count: number
  nonviolent_choices: number
  total_choices: number
}

export type EvaluationResponse = {
  evaluation_id: number
  predicted_path: string
  risk_band: string
  cohort_label: string
  confidence: number
  path_probabilities: ProbabilityPoint[]
  risk_probabilities: ProbabilityPoint[]
  top_drivers: Array<{
    feature: string
    impact: number
    direction: 'positive' | 'negative'
  }>
  intervention_plan: string[]
  suggested_scene_focus: string
  feature_snapshot: Record<string, number>
  training_rows: number
  model_summary: ModelSummary
}

export type PipelineRefresh = {
  training_rows: number
  trained_at: string
}

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  expires_at: string
  username: string
  role: string
}

export type AdminStatusResponse = {
  database_backend: string
  database_url: string
  latest_snapshot: SnapshotSummary | null
  scheduler: SchedulerStatus
  model_summary: ModelSummary
  current_user: {
    username: string
    role: string
  }
}

export type WorkflowName = 'etl_snapshot' | 'model_retrain' | 'full_refresh' | 'benchmark_suite'

export type WorkflowRunSummary = {
  workflow_name: WorkflowName
  trigger: string
  status: string
  actor: string
  rows_processed: number
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  message: string | null
  details_json: string | null
}

export type WorkflowTriggerResponse = {
  workflow_name: WorkflowName
  trigger: string
  status: string
  details: Record<string, unknown>
}

export type AgentName = 'mentor' | 'strategist' | 'historian' | 'operations' | 'planner'
export type PublicAgentName = 'mentor' | 'strategist' | 'historian'

export type AgentCatalogEntry = {
  name: AgentName
  display_name: string
  role: string
  description: string
  requires_admin: boolean
}

export type AgentInsight = {
  agent_name: AgentName
  display_name: string
  role: string
  summary: string
  confidence: number
  priority: 'low' | 'medium' | 'high'
  signals: string[]
  actions: string[]
}

export type KnowledgeDocument = {
  document_id: string
  title: string
  era: string
  theme: string
  relevance: number
  summary: string
  teaching_use: string
}

export type AgentMemorySummary = {
  learner_id: string
  run_count: number
  last_path: string | null
  last_risk: string | null
  dominant_agent: AgentName | null
  last_run_at: string | null
}

export type AgentMemoryEntry = {
  learner_id: string
  agent_name: AgentName
  display_name: string
  priority: 'low' | 'medium' | 'high'
  confidence: number
  summary: string
  predicted_path: string
  risk_band: string
  scene_focus: string
  knowledge_document_ids: string[]
  created_at: string
}

export type AgentMemoryResponse = {
  summary: AgentMemorySummary
  timeline: AgentMemoryEntry[]
}

export type AgentRunResponse = {
  generated_at: string
  evaluation: AgentEvaluationSnapshot
  agents: AgentInsight[]
  knowledge_matches: KnowledgeDocument[]
  memory: AgentMemoryResponse
}

export type AdminAgentBriefingResponse = {
  generated_at: string
  operations_agent: AgentInsight
}

export type AgentEvaluationSnapshot = {
  predicted_path: string
  risk_band: string
  confidence: number
  cohort_label: string
  suggested_scene_focus: string
}

export type TemporalLearnerState = {
  learner_id: string
  session_count: number
  average_mastery: number
  average_accuracy: number
  mastery_velocity: number
  accuracy_velocity: number
  risk_stability: number
  path_consistency: number
  intervention_effectiveness: number
  momentum_label: string
  recommended_intensity: string
  current_path: string
  current_risk: string
  narrative: string
}

export type GraphNode = {
  id: string
  label: string
  node_type: string
}

export type GraphEdge = {
  source: string
  target: string
  relationship: string
}

export type GraphContextResponse = {
  scene_focus: string
  predicted_path: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  highlights: string[]
}

export type ExperimentRecommendationResponse = {
  assignment_id: number
  learner_id: string
  policy_name: string
  policy_label: string
  rationale: string
  estimated_lift: number
  exploration_score: number
  exploitation_score: number
  assigned_at: string
}

export type ExperimentPolicyMetrics = {
  policy_name: string
  policy_label: string
  assignment_count: number
  average_estimated_lift: number
}

export type ExperimentMetricsResponse = {
  total_assignments: number
  policies: ExperimentPolicyMetrics[]
}

export type EventTypeCount = {
  event_type: string
  count: number
}

export type EventRecord = {
  event_type: string
  source: string
  learner_id: string | null
  created_at: string
  payload_preview: string
}

export type EventPipelineResponse = {
  total_events: number
  latest_event_at: string | null
  event_types: EventTypeCount[]
  recent_events: EventRecord[]
}

export type MissionStep = {
  step_number: number
  title: string
  purpose: string
  recommended_agent: AgentName
  duration_minutes: number
  success_signal: string
  resources: string[]
}

export type MissionCheckpoint = {
  name: string
  description: string
  metric: string
}

export type MissionBranch = {
  condition: string
  fallback_step: string
}

export type MissionPlanResponse = {
  plan_id: number
  learner_id: string
  generated_at: string
  mission_title: string
  objective: string
  target_path: string
  target_scene: string
  planner_agent: AgentInsight
  supporting_agents: AgentInsight[]
  temporal_state: TemporalLearnerState
  experiment_policy: ExperimentRecommendationResponse
  knowledge_matches: KnowledgeDocument[]
  graph_context: GraphContextResponse
  steps: MissionStep[]
  checkpoints: MissionCheckpoint[]
  branches: MissionBranch[]
  completion_criteria: string[]
}

export type BenchmarkScore = {
  benchmark_name: string
  score: number
  status: 'pass' | 'warn' | 'fail'
  summary: string
}

export type BenchmarkReportResponse = {
  generated_at: string
  overall_score: number
  benchmarks: BenchmarkScore[]
  recommendations: string[]
}
