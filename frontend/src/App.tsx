import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react'
import './App.css'
import { ApiError, api } from './api'
import type {
  AdminAgentBriefingResponse,
  AdminStatusResponse,
  AgentCatalogEntry,
  AgentEvaluationSnapshot,
  AgentInsight,
  AgentMemoryResponse,
  AgentRunResponse,
  BenchmarkReportResponse,
  DashboardOverview,
  EvaluationResponse,
  EventPipelineResponse,
  ExperimentMetricsResponse,
  ExperimentRecommendationResponse,
  GraphContextResponse,
  HealthStatus,
  KnowledgeDocument,
  LearnerProfileInput,
  MissionPlanResponse,
  PipelineRefresh,
  SnapshotSummary,
  TemporalLearnerState,
  WorkflowName,
  WorkflowRunSummary,
} from './types'

const ADMIN_TOKEN_STORAGE_KEY = 'mlk-admin-token'

const defaultProfile: LearnerProfileInput = {
  learner_id: 'innovation-lab',
  hope: 74,
  courage: 67,
  wisdom: 82,
  leadership: 79,
  questions_answered: 18,
  accuracy_rate: 91,
  historical_alignment: 88,
  minutes_spent: 48,
  achievement_count: 7,
  nonviolent_choices: 11,
  total_choices: 13,
}

const defaultCredentials = {
  username: 'admin',
  password: 'mlk-admin-demo',
}

function App() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalogEntry[]>([])
  const [agentRun, setAgentRun] = useState<AgentRunResponse | null>(null)
  const [agentMemory, setAgentMemory] = useState<AgentMemoryResponse | null>(null)
  const [temporalState, setTemporalState] = useState<TemporalLearnerState | null>(null)
  const [graphContext, setGraphContext] = useState<GraphContextResponse | null>(null)
  const [experimentRecommendation, setExperimentRecommendation] = useState<ExperimentRecommendationResponse | null>(null)
  const [missionPlan, setMissionPlan] = useState<MissionPlanResponse | null>(null)
  const [adminStatus, setAdminStatus] = useState<AdminStatusResponse | null>(null)
  const [adminAgentBriefing, setAdminAgentBriefing] = useState<AdminAgentBriefingResponse | null>(null)
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunSummary[]>([])
  const [eventPipeline, setEventPipeline] = useState<EventPipelineResponse | null>(null)
  const [experimentMetrics, setExperimentMetrics] = useState<ExperimentMetricsResponse | null>(null)
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReportResponse | null>(null)
  const [pipelineRefresh, setPipelineRefresh] = useState<PipelineRefresh | null>(null)
  const [profile, setProfile] = useState<LearnerProfileInput>(defaultProfile)
  const [credentials, setCredentials] = useState(defaultCredentials)
  const [result, setResult] = useState<EvaluationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [opsMessage, setOpsMessage] = useState<string | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [token, setToken] = useState(() => window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '')

  const deferredOverview = useDeferredValue(overview)
  const deferredResult = useDeferredValue(result)
  const deferredAgentCatalog = useDeferredValue(agentCatalog)
  const deferredAgentRun = useDeferredValue(agentRun)
  const deferredAgentMemory = useDeferredValue(agentMemory)
  const deferredTemporalState = useDeferredValue(temporalState)
  const deferredGraphContext = useDeferredValue(graphContext)
  const deferredExperimentRecommendation = useDeferredValue(experimentRecommendation)
  const deferredMissionPlan = useDeferredValue(missionPlan)
  const deferredAdminStatus = useDeferredValue(adminStatus)
  const deferredAdminAgentBriefing = useDeferredValue(adminAgentBriefing)
  const deferredWorkflowRuns = useDeferredValue(workflowRuns)
  const deferredEventPipeline = useDeferredValue(eventPipeline)
  const deferredExperimentMetrics = useDeferredValue(experimentMetrics)
  const deferredBenchmarkReport = useDeferredValue(benchmarkReport)

  const clearAdminState = useEffectEvent(() => {
    startTransition(() => {
      setToken('')
      setAdminStatus(null)
      setAdminAgentBriefing(null)
      setWorkflowRuns([])
      setEventPipeline(null)
      setExperimentMetrics(null)
      setBenchmarkReport(null)
      setPipelineRefresh(null)
    })
  })

  const refreshOverview = useEffectEvent(async (showBootRibbon = false) => {
    if (showBootRibbon) {
      setIsBooting(true)
    }

    setError(null)

    try {
      const [overviewResponse, healthResponse, catalogResponse] = await Promise.all([
        api.overview(),
        api.health(),
        api.agentCatalog(),
      ])

      startTransition(() => {
        setOverview(overviewResponse)
        setHealth(healthResponse)
        setAgentCatalog(catalogResponse)
      })
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'Failed to connect to the intelligence platform.'))
    } finally {
      if (showBootRibbon) {
        setIsBooting(false)
      }
    }
  })

  const refreshAdminData = useEffectEvent(async (activeToken: string) => {
    if (!activeToken) {
      return
    }

    setAuthError(null)

    try {
      const [statusResponse, runsResponse, briefingResponse, eventResponse, metricsResponse] = await Promise.all([
        api.adminStatus(activeToken),
        api.workflowRuns(activeToken),
        api.adminAgentBriefing(activeToken),
        api.pipelineEvents(activeToken),
        api.experimentMetrics(activeToken),
      ])
      let latestBenchmark: BenchmarkReportResponse | null = null
      try {
        latestBenchmark = await api.latestBenchmark(activeToken)
      } catch (benchmarkError) {
        if (!(benchmarkError instanceof ApiError && benchmarkError.status === 404)) {
          throw benchmarkError
        }
      }

      startTransition(() => {
        setAdminStatus(statusResponse)
        setWorkflowRuns(runsResponse)
        setAdminAgentBriefing(briefingResponse)
        setEventPipeline(eventResponse)
        setExperimentMetrics(metricsResponse)
        setBenchmarkReport(latestBenchmark)
      })
    } catch (adminDataError) {
      if (isUnauthorized(adminDataError)) {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
        clearAdminState()
        setAuthError('Admin session expired. Log in again.')
        return
      }

      setAuthError(getErrorMessage(adminDataError, 'Failed to load admin operations.'))
    }
  })

  useEffect(() => {
    void refreshOverview(true)
  }, [])

  useEffect(() => {
    if (!token) {
      startTransition(() => {
        setAdminStatus(null)
        setAdminAgentBriefing(null)
        setWorkflowRuns([])
        setEventPipeline(null)
        setExperimentMetrics(null)
        setBenchmarkReport(null)
        setPipelineRefresh(null)
      })
      return
    }

    void refreshAdminData(token)
  }, [token])

  async function runLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsWorking(true)
    setError(null)
    setOpsMessage(null)

    try {
      const evaluation = await api.evaluate(profile)
      const plan = await api.runPlanner(profile)
      const [memory, temporal] = await Promise.all([
        api.agentMemory(profile.learner_id),
        api.temporalState(profile.learner_id),
      ])

      await refreshOverview(false)
      if (token) {
        await refreshAdminData(token)
      }

      const evaluationSnapshot = buildEvaluationSnapshot(evaluation)
      startTransition(() => {
        setResult(evaluation)
        applyMissionState({
          plan,
          evaluation: evaluationSnapshot,
          memory,
          temporal,
          setMissionPlan,
          setExperimentRecommendation,
          setGraphContext,
          setTemporalState,
          setAgentRun,
          setAgentMemory,
        })
      })
      setOpsMessage(`Planner Agent generated mission #${plan.plan_id} for ${profile.learner_id}.`)
    } catch (labError) {
      setError(getErrorMessage(labError, 'Evaluation failed.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function runLocalAgents() {
    setIsWorking(true)
    setError(null)
    setOpsMessage(null)

    try {
      const response = await api.runAgents(profile)
      const graph = await api.graphContext(
        response.evaluation.suggested_scene_focus,
        response.evaluation.predicted_path,
      )

      await refreshOverview(false)
      if (token) {
        await refreshAdminData(token)
      }

      startTransition(() => {
        setAgentRun(response)
        setAgentMemory(response.memory)
        setGraphContext(graph)
      })
      setOpsMessage(`Local agents updated guidance for ${profile.learner_id}.`)
    } catch (agentError) {
      setError(getErrorMessage(agentError, 'Local agent run failed.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function buildMission() {
    setIsWorking(true)
    setError(null)
    setOpsMessage(null)

    try {
      const plan = await api.runPlanner(profile)
      const memory = await api.agentMemory(profile.learner_id)
      let temporal = plan.temporal_state

      try {
        temporal = await api.temporalState(profile.learner_id)
      } catch (temporalError) {
        if (!(temporalError instanceof ApiError && temporalError.status === 404)) {
          throw temporalError
        }
      }

      await refreshOverview(false)
      if (token) {
        await refreshAdminData(token)
      }

      startTransition(() => {
        applyMissionState({
          plan,
          evaluation: deriveEvaluationFromPlan(plan, deferredResult),
          memory,
          temporal,
          setMissionPlan,
          setExperimentRecommendation,
          setGraphContext,
          setTemporalState,
          setAgentRun,
          setAgentMemory,
        })
      })
      setOpsMessage(`Mission plan #${plan.plan_id} is ready.`)
    } catch (planError) {
      setError(getErrorMessage(planError, 'Mission planning failed.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function loadLatestMission() {
    setIsWorking(true)
    setError(null)
    setOpsMessage(null)

    try {
      const [plan, memory] = await Promise.all([
        api.latestPlan(profile.learner_id),
        api.agentMemory(profile.learner_id),
      ])

      startTransition(() => {
        applyMissionState({
          plan,
          evaluation: deriveEvaluationFromPlan(plan, deferredResult),
          memory,
          temporal: plan.temporal_state,
          setMissionPlan,
          setExperimentRecommendation,
          setGraphContext,
          setTemporalState,
          setAgentRun,
          setAgentMemory,
        })
      })
      setOpsMessage(`Loaded persisted mission #${plan.plan_id}.`)
    } catch (missionError) {
      setError(getErrorMessage(missionError, 'No persisted mission plan was found for this learner.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function loadAgentMemory() {
    setIsWorking(true)
    setError(null)

    try {
      const memory = await api.agentMemory(profile.learner_id)
      startTransition(() => {
        setAgentMemory(memory)
      })
    } catch (memoryError) {
      setError(getErrorMessage(memoryError, 'Failed to load agent memory.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function loadTemporalHistory() {
    setIsWorking(true)
    setError(null)

    try {
      const temporal = await api.temporalState(profile.learner_id)
      startTransition(() => {
        setTemporalState(temporal)
      })
    } catch (temporalError) {
      setError(getErrorMessage(temporalError, 'Run a persisted evaluation first to create learner history.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsWorking(true)
    setAuthError(null)
    setOpsMessage(null)

    try {
      const session = await api.login({
        username: credentials.username.trim(),
        password: credentials.password,
      })

      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, session.access_token)
      startTransition(() => {
        setToken(session.access_token)
      })
      setOpsMessage(`Admin session active until ${formatTimestamp(session.expires_at)}.`)
    } catch (loginError) {
      setAuthError(getErrorMessage(loginError, 'Login failed.'))
    } finally {
      setIsWorking(false)
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    clearAdminState()
    setAuthError(null)
    setOpsMessage('Admin session cleared.')
  }

  async function runWorkflow(workflowName: WorkflowName) {
    if (!token) {
      setAuthError('Log in as admin to run workflows.')
      return
    }

    setIsWorking(true)
    setAuthError(null)
    setOpsMessage(null)

    try {
      const response = await api.triggerWorkflow(token, workflowName)
      await Promise.all([
        refreshOverview(false),
        refreshAdminData(token),
      ])
      setOpsMessage(`${formatWorkflowName(response.workflow_name)} finished with status ${response.status}.`)
    } catch (workflowError) {
      if (isUnauthorized(workflowError)) {
        handleLogout()
        setAuthError('Admin session expired. Log in again.')
      } else {
        setAuthError(getErrorMessage(workflowError, 'Workflow execution failed.'))
      }
    } finally {
      setIsWorking(false)
    }
  }

  async function retrainPipeline() {
    if (!token) {
      setAuthError('Log in as admin to retrain models.')
      return
    }

    setIsWorking(true)
    setAuthError(null)
    setOpsMessage(null)

    try {
      const refreshResponse = await api.retrain(token)
      await Promise.all([
        refreshOverview(false),
        refreshAdminData(token),
      ])
      startTransition(() => {
        setPipelineRefresh(refreshResponse)
      })
      setOpsMessage(`Secure retraining finished at ${formatTimestamp(refreshResponse.trained_at)}.`)
    } catch (retrainError) {
      if (isUnauthorized(retrainError)) {
        handleLogout()
        setAuthError('Admin session expired. Log in again.')
      } else {
        setAuthError(getErrorMessage(retrainError, 'Retraining failed.'))
      }
    } finally {
      setIsWorking(false)
    }
  }

  async function runBenchmarkSuite() {
    if (!token) {
      setAuthError('Log in as admin to run benchmarks.')
      return
    }

    setIsWorking(true)
    setAuthError(null)
    setOpsMessage(null)

    try {
      const report = await api.runBenchmarks(token)
      await refreshAdminData(token)
      startTransition(() => {
        setBenchmarkReport(report)
      })
      setOpsMessage(`Benchmark suite completed with overall score ${report.overall_score}%.`)
    } catch (benchmarkError) {
      if (isUnauthorized(benchmarkError)) {
        handleLogout()
        setAuthError('Admin session expired. Log in again.')
      } else {
        setAuthError(getErrorMessage(benchmarkError, 'Benchmark suite failed.'))
      }
    } finally {
      setIsWorking(false)
    }
  }

  function updateField<K extends keyof LearnerProfileInput>(field: K, value: LearnerProfileInput[K]) {
    setProfile(current => ({ ...current, [field]: value }))
  }

  function updateCredential(field: 'username' | 'password', value: string) {
    setCredentials(current => ({ ...current, [field]: value }))
  }

  const latestSnapshot = deferredAdminStatus?.latest_snapshot ?? deferredOverview?.latest_snapshot ?? null
  const riskTone = deferredResult?.risk_band ?? deferredMissionPlan?.temporal_state.current_risk ?? 'balanced'
  const authenticated = token.length > 0

  return (
    <div className="app-shell">
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      <main className="dashboard">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">MLK Legacy Control Room</p>
            <h1>Data engineering, local agents, mission planning, and adaptive intelligence for a deeper civil-rights platform.</h1>
            <p className="hero-text">
              The preserved legacy HTML still exists, while the modern platform now layers a temporal learner model,
              knowledge graph reasoning, experimentation policies, benchmark evaluation, and event-driven orchestration
              on top of the warehouse and local models without any external API dependency.
            </p>
          </div>

          <div className="ops-shell">
            <div className="hero-actions">
              <div className={`status-pill ${health?.trained ? 'trained' : 'untrained'}`}>
                <span className="status-dot" />
                {health?.trained ? 'Models trained' : 'Waiting for backend'}
              </div>
              <div className="status-pill neutral">
                <span className="status-dot" />
                DB {health?.database_backend ?? 'pending'}
              </div>
              <button className="action-button secondary" onClick={() => void refreshOverview(false)} disabled={isWorking}>
                Refresh Public View
              </button>
              <button className="action-button" onClick={() => void runLocalAgents()} disabled={isWorking}>
                Run Local Agents
              </button>
              <button className="action-button dark" onClick={() => void buildMission()} disabled={isWorking}>
                Build Mission
              </button>
              {authenticated ? (
                <>
                  <button className="action-button secondary" onClick={() => void runBenchmarkSuite()} disabled={isWorking}>
                    Run Benchmarks
                  </button>
                  <button className="action-button dark" onClick={() => void retrainPipeline()} disabled={isWorking}>
                    Secure Retrain
                  </button>
                </>
              ) : null}
              {deferredOverview?.legacy_url ? (
                <a className="legacy-link" href={deferredOverview.legacy_url} target="_blank" rel="noreferrer">
                  Open Preserved Legacy HTML
                </a>
              ) : null}
            </div>

            {authenticated ? (
              <div className="auth-panel">
                <div className="ops-topline">
                  <div>
                    <p className="mini-label">Admin control</p>
                    <h2>{deferredAdminStatus?.current_user.username ?? 'Syncing session'}</h2>
                  </div>
                  <button className="text-button" onClick={handleLogout} type="button">
                    Log out
                  </button>
                </div>
                <p className="auth-hint">
                  Scheduler {health?.scheduler.enabled ? 'enabled' : 'disabled'}.
                  Active tasks {health?.scheduler.active_tasks ?? 0}.
                </p>
                {deferredAdminStatus ? (
                  <p className="auth-hint">
                    {deferredAdminStatus.current_user.role} access on {maskDatabaseUrl(deferredAdminStatus.database_url)}.
                  </p>
                ) : (
                  <p className="auth-hint">Admin metadata is loading.</p>
                )}
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleLogin}>
                <div className="auth-copy">
                  <p className="mini-label">Admin login</p>
                  <h2>Unlock ETL, event monitoring, benchmark control, experimentation metrics, and the operations agent.</h2>
                </div>

                <label className="field">
                  <span>Username</span>
                  <input
                    value={credentials.username}
                    onChange={event => updateCredential('username', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={event => updateCredential('password', event.target.value)}
                  />
                </label>

                <button className="action-button full-width" disabled={isWorking}>
                  {isWorking ? 'Signing in...' : 'Sign in as Admin'}
                </button>

                <p className="auth-hint">Default local credentials: <code>admin</code> / <code>mlk-admin-demo</code>.</p>
              </form>
            )}
          </div>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}
        {authError ? <section className="error-banner auth-error">{authError}</section> : null}
        {opsMessage ? <section className="notice-banner">{opsMessage}</section> : null}

        <section className="metrics-grid">
          <MetricCard label="Learners in warehouse" value={deferredOverview?.headline_metrics.learners_total} />
          <MetricCard label="Average mastery" value={deferredOverview?.headline_metrics.average_mastery} suffix="%" />
          <MetricCard label="Average accuracy" value={deferredOverview?.headline_metrics.average_accuracy} suffix="%" />
          <MetricCard label="Average session time" value={deferredOverview?.headline_metrics.average_time_minutes} suffix=" min" />
          <MetricCard label="High risk share" value={deferredOverview?.headline_metrics.high_risk_share} suffix="%" />
          <MetricCard label="Policy-ready cohort" value={deferredOverview?.headline_metrics.policy_ready_share} suffix="%" />
        </section>

        {authenticated ? (
          <section className="ops-grid">
            <Panel
              title="Operations Center"
              subtitle="Protected scheduler state, warehouse snapshots, workflow controls, and the local operations agent."
            >
              <div className="ops-pills">
                <OpsPill label="Scheduler" value={health?.scheduler.enabled ? 'Enabled' : 'Disabled'} />
                <OpsPill label="ETL cadence" value={formatSeconds(health?.scheduler.etl_interval_seconds)} />
                <OpsPill label="Retrain cadence" value={formatSeconds(health?.scheduler.retrain_interval_seconds)} />
                <OpsPill label="Benchmark cadence" value={formatSeconds(health?.scheduler.benchmark_interval_seconds)} />
                <OpsPill label="Active tasks" value={String(health?.scheduler.active_tasks ?? 0)} />
                <OpsPill label="Training rows" value={String(deferredAdminStatus?.model_summary.training_rows ?? deferredOverview?.model_summary.training_rows ?? 0)} />
                <OpsPill label="Path classes" value={String(deferredAdminStatus?.model_summary.path_classes.length ?? deferredOverview?.model_summary.path_classes.length ?? 0)} />
              </div>

              <div className="workflow-actions">
                <button className="action-button" onClick={() => void runWorkflow('etl_snapshot')} disabled={isWorking}>
                  Materialize Snapshot
                </button>
                <button className="action-button dark" onClick={() => void runWorkflow('full_refresh')} disabled={isWorking}>
                  Full Refresh
                </button>
                <button className="action-button secondary" onClick={() => void runWorkflow('model_retrain')} disabled={isWorking}>
                  Workflow Retrain
                </button>
                <button className="action-button secondary" onClick={() => void runWorkflow('benchmark_suite')} disabled={isWorking}>
                  Benchmark Workflow
                </button>
                <button className="action-button dark" onClick={() => void retrainPipeline()} disabled={isWorking}>
                  Secure Retrain API
                </button>
                <button className="action-button" onClick={() => void runBenchmarkSuite()} disabled={isWorking}>
                  Benchmark API
                </button>
              </div>

              <SnapshotCard snapshot={latestSnapshot} />

              {deferredAdminAgentBriefing ? (
                <AgentInsightCard insight={deferredAdminAgentBriefing.operations_agent} tone="operations" />
              ) : (
                <div className="empty-state">Operations agent briefing is not available yet.</div>
              )}

              {pipelineRefresh ? (
                <div className="result-card tone-balanced">
                  <div className="result-footer single-row">
                    <span>Last secure retrain: {formatTimestamp(pipelineRefresh.trained_at)}</span>
                    <span>Rows trained: {pipelineRefresh.training_rows}</span>
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel
              title="Monitoring Stack"
              subtitle="Workflow history, event pipeline, experimentation metrics, and benchmark health."
            >
              {deferredBenchmarkReport ? (
                <div className="subsection">
                  <h3>Benchmark Report</h3>
                  <BenchmarkReportCard report={deferredBenchmarkReport} />
                </div>
              ) : null}

              <div className="subsection">
                <h3>Experiment Policies</h3>
                {deferredExperimentMetrics ? (
                  <ExperimentMetricsCard metrics={deferredExperimentMetrics} />
                ) : (
                  <div className="empty-state">Experiment policy metrics are loading.</div>
                )}
              </div>

              <div className="subsection">
                <h3>Event Pipeline</h3>
                {deferredEventPipeline ? (
                  <EventPipelineCard pipeline={deferredEventPipeline} />
                ) : (
                  <div className="empty-state">Event pipeline data is loading.</div>
                )}
              </div>

              <div className="subsection">
                <h3>Workflow Ledger</h3>
                {deferredWorkflowRuns.length > 0 ? (
                  <div className="workflow-list">
                    {deferredWorkflowRuns.map(run => (
                      <article className="workflow-item" key={`${run.workflow_name}-${run.started_at}`}>
                        <div className="workflow-head">
                          <div>
                            <h3>{formatWorkflowName(run.workflow_name)}</h3>
                            <p>{run.message ?? 'Workflow completed.'}</p>
                          </div>
                          <span className={`workflow-badge ${statusClassName(run.status)}`}>{run.status}</span>
                        </div>
                        <div className="workflow-meta">
                          <span>Trigger {run.trigger}</span>
                          <span>Actor {run.actor}</span>
                          <span>Rows {run.rows_processed}</span>
                          <span>Started {formatTimestamp(run.started_at)}</span>
                          <span>Duration {run.duration_ms ? `${run.duration_ms} ms` : 'n/a'}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No workflow executions recorded yet.</div>
                )}
              </div>
            </Panel>
          </section>
        ) : null}

        <section className="content-grid">
          <div className="stack">
            <Panel
              title="Narrative Distribution"
              subtitle="How the warehouse is segmenting pathways across the current learner cohort."
            >
              <DistributionList items={deferredOverview?.path_distribution ?? []} tone="warm" />
            </Panel>

            <Panel
              title="Engagement Risk"
              subtitle="Support-need pressure points derived from engineered cohort features."
            >
              <DistributionList items={deferredOverview?.risk_distribution ?? []} tone="cool" />
            </Panel>

            <Panel
              title="Weekly Mastery Drift"
              subtitle="Rolling learner health through mastery, accuracy, and support need."
            >
              <TrendStrip points={deferredOverview?.weekly_mastery_trend ?? []} />
            </Panel>

            <Panel
              title="Cohort Segments"
              subtitle="Warehouse-level slices generated after feature engineering."
            >
              <div className="segment-list">
                {(deferredOverview?.cohort_segments ?? []).map(segment => (
                  <article className="segment-card" key={segment.segment}>
                    <h3>{segment.segment}</h3>
                    <p>{segment.learner_count} learners</p>
                    <div className="segment-meta">
                      <span>Mastery {segment.avg_mastery}%</span>
                      <span>Accuracy {segment.avg_accuracy}%</span>
                      <span>Time {segment.avg_time} min</span>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel
              title="Knowledge Graph Context"
              subtitle="Scene, people, laws, and movement themes linked for local reasoning."
            >
              {deferredGraphContext ? (
                <GraphContextCard context={deferredGraphContext} />
              ) : (
                <div className="empty-state">
                  Run local agents or the planner to populate the graph neighborhood for the current learner.
                </div>
              )}
            </Panel>
          </div>

          <div className="stack">
            <Panel
              title="Live Inference Lab"
              subtitle="Persist an evaluation, refresh the planner stack, and update local memory in one run."
            >
              <form className="lab-form" onSubmit={runLab}>
                <label className="field">
                  <span>Learner ID</span>
                  <input
                    value={profile.learner_id}
                    onChange={event => updateField('learner_id', event.target.value)}
                  />
                </label>

                <div className="slider-grid">
                  <SliderField label="Hope" value={profile.hope} onChange={value => updateField('hope', value)} />
                  <SliderField label="Courage" value={profile.courage} onChange={value => updateField('courage', value)} />
                  <SliderField label="Wisdom" value={profile.wisdom} onChange={value => updateField('wisdom', value)} />
                  <SliderField label="Leadership" value={profile.leadership} onChange={value => updateField('leadership', value)} />
                  <SliderField label="Accuracy" value={profile.accuracy_rate} onChange={value => updateField('accuracy_rate', value)} />
                  <SliderField label="Historical Alignment" value={profile.historical_alignment} onChange={value => updateField('historical_alignment', value)} />
                </div>

                <div className="number-grid">
                  <NumericField label="Questions Answered" value={profile.questions_answered} onChange={value => updateField('questions_answered', value)} />
                  <NumericField label="Minutes Spent" value={profile.minutes_spent} onChange={value => updateField('minutes_spent', value)} />
                  <NumericField label="Achievement Count" value={profile.achievement_count} onChange={value => updateField('achievement_count', value)} />
                  <NumericField label="Nonviolent Choices" value={profile.nonviolent_choices} onChange={value => updateField('nonviolent_choices', value)} />
                  <NumericField label="Total Choices" value={profile.total_choices} onChange={value => updateField('total_choices', value)} />
                </div>

                <button className="action-button full-width" disabled={isWorking || isBooting}>
                  {isWorking ? 'Running models...' : 'Evaluate Learner'}
                </button>
              </form>
            </Panel>

            <Panel
              title="Local Agent Studio"
              subtitle="Mentor, strategist, historian, and planner outputs grounded in local memory and retrieved context."
            >
              <div className="agent-catalog">
                {deferredAgentCatalog.map(agent => (
                  <article className={`agent-chip ${agent.requires_admin ? 'locked' : 'open'}`} key={agent.name}>
                    <strong>{agent.display_name}</strong>
                    <span>{agent.role}</span>
                  </article>
                ))}
              </div>

              <div className="workflow-actions">
                <button className="action-button" onClick={() => void runLocalAgents()} disabled={isWorking}>
                  Run Local Agents
                </button>
                <button className="action-button dark" onClick={() => void buildMission()} disabled={isWorking}>
                  Build Mission
                </button>
                <button className="action-button secondary" onClick={() => void loadAgentMemory()} disabled={isWorking}>
                  Load Memory
                </button>
                <button className="action-button secondary" onClick={() => void loadTemporalHistory()} disabled={isWorking}>
                  Load Temporal
                </button>
                <button className="action-button" onClick={() => void loadLatestMission()} disabled={isWorking}>
                  Load Latest Mission
                </button>
              </div>

              {deferredAgentRun ? (
                <>
                  <div className="agent-run-header">
                    <span>Path {deferredAgentRun.evaluation.predicted_path.replaceAll('_', ' ')}</span>
                    <span>Risk {deferredAgentRun.evaluation.risk_band}</span>
                    <span>Scene {deferredAgentRun.evaluation.suggested_scene_focus}</span>
                    <span>Generated {formatTimestamp(deferredAgentRun.generated_at)}</span>
                  </div>

                  <div className="agent-list">
                    {deferredAgentRun.agents.map(agent => (
                      <AgentInsightCard insight={agent} key={agent.agent_name} />
                    ))}
                  </div>

                  <div className="knowledge-grid">
                    {deferredAgentRun.knowledge_matches.map(document => (
                      <KnowledgeCard document={document} key={document.document_id} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  Run the lab, the mission planner, or local agents directly to generate contextual guidance.
                </div>
              )}

              {deferredAgentMemory ? (
                <>
                  <div className="memory-summary">
                    <span>Memory runs {deferredAgentMemory.summary.run_count}</span>
                    <span>Last path {deferredAgentMemory.summary.last_path?.replaceAll('_', ' ') ?? 'n/a'}</span>
                    <span>Last risk {deferredAgentMemory.summary.last_risk ?? 'n/a'}</span>
                    <span>Updated {formatTimestamp(deferredAgentMemory.summary.last_run_at)}</span>
                  </div>

                  <div className="memory-timeline">
                    {deferredAgentMemory.timeline.map(entry => (
                      <MemoryCard entry={entry} key={`${entry.agent_name}-${entry.created_at}`} />
                    ))}
                  </div>
                </>
              ) : null}
            </Panel>

            <Panel
              title="Temporal Learner Model"
              subtitle="Time-series state, momentum, support pressure, and adaptive experiment policy."
            >
              {deferredTemporalState ? (
                <div className={`result-card tone-${riskTone}`}>
                  <p className="temporal-narrative">{deferredTemporalState.narrative}</p>
                  <div className="snapshot-card-grid">
                    <div>
                      <span>Momentum</span>
                      <strong>{deferredTemporalState.momentum_label}</strong>
                    </div>
                    <div>
                      <span>Intensity</span>
                      <strong>{deferredTemporalState.recommended_intensity}</strong>
                    </div>
                    <div>
                      <span>Sessions</span>
                      <strong>{deferredTemporalState.session_count}</strong>
                    </div>
                    <div>
                      <span>Mastery velocity</span>
                      <strong>{deferredTemporalState.mastery_velocity}</strong>
                    </div>
                    <div>
                      <span>Accuracy velocity</span>
                      <strong>{deferredTemporalState.accuracy_velocity}</strong>
                    </div>
                    <div>
                      <span>Intervention effect</span>
                      <strong>{deferredTemporalState.intervention_effectiveness}%</strong>
                    </div>
                  </div>

                  <div className="result-footer">
                    <span>Average mastery {deferredTemporalState.average_mastery}%</span>
                    <span>Average accuracy {deferredTemporalState.average_accuracy}%</span>
                    <span>Risk stability {deferredTemporalState.risk_stability}%</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Temporal learner history will appear after the first persisted evaluation.</div>
              )}

              {deferredExperimentRecommendation ? (
                <ExperimentRecommendationCard recommendation={deferredExperimentRecommendation} />
              ) : (
                <div className="empty-state">Experiment policy recommendations will appear with a mission plan.</div>
              )}
            </Panel>

            <Panel
              title="Planner Agent Mission"
              subtitle="Multi-step missions with checkpoints, branches, and completion criteria."
            >
              {deferredMissionPlan ? (
                <MissionPlanCard plan={deferredMissionPlan} />
              ) : (
                <div className="empty-state">
                  Run the planner to generate a structured mission sequence with graph, temporal, and policy context.
                </div>
              )}
            </Panel>

            <Panel
              title="Inference Result"
              subtitle="Recommended pathway, risk posture, explanatory drivers, and interventions."
            >
              {deferredResult ? (
                <div className={`result-card tone-${riskTone}`}>
                  <div className="result-header">
                    <div>
                      <p className="mini-label">Predicted Path</p>
                      <h3>{deferredResult.predicted_path.replaceAll('_', ' ')}</h3>
                    </div>
                    <div>
                      <p className="mini-label">Risk Band</p>
                      <h3>{deferredResult.risk_band}</h3>
                    </div>
                    <div>
                      <p className="mini-label">Confidence</p>
                      <h3>{deferredResult.confidence}%</h3>
                    </div>
                  </div>

                  <div className="snapshot-grid">
                    {Object.entries(deferredResult.feature_snapshot).map(([key, value]) => (
                      <div className="snapshot-pill" key={key}>
                        <span>{key.replaceAll('_', ' ')}</span>
                        <strong>{Math.round(value)}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="two-column">
                    <div>
                      <p className="mini-label">Top Drivers</p>
                      <ul className="dense-list">
                        {deferredResult.top_drivers.map(driver => (
                          <li key={driver.feature}>
                            <strong>{driver.feature}</strong>
                            <span>{driver.direction === 'positive' ? '+' : ''}{driver.impact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="mini-label">Intervention Plan</p>
                      <ul className="dense-list narrative">
                        {deferredResult.intervention_plan.map(step => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="result-footer">
                    <span>Cohort label: {deferredResult.cohort_label}</span>
                    <span>Suggested scene focus: {deferredResult.suggested_scene_focus}</span>
                    <span>Training rows: {deferredResult.training_rows}</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  Run the lab to generate a personalized recommendation and push it into the warehouse.
                </div>
              )}
            </Panel>

            <Panel
              title="Model Top Features"
              subtitle="Highest-weight features driving current path classification."
            >
              <div className="feature-list">
                {(deferredOverview?.model_summary.top_features ?? []).map(feature => (
                  <div className="feature-row" key={feature.feature}>
                    <span>{feature.feature.replaceAll('_', ' ')}</span>
                    <div className="feature-bar">
                      <div style={{ width: `${Math.min(feature.importance * 100, 100)}%` }} />
                    </div>
                    <strong>{feature.importance.toFixed(3)}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section className="lower-grid">
          <Panel
            title="Recent Sessions"
            subtitle="Latest learner states committed into the warehouse."
          >
            <div className="session-table">
              {(deferredOverview?.recent_sessions ?? []).map(session => (
                <article className="session-row" key={`${session.learner_label}-${session.created_at}`}>
                  <div>
                    <h3>{session.learner_label}</h3>
                    <p>{session.narrative_focus}</p>
                  </div>
                  <div>
                    <p>Risk {session.engagement_risk}</p>
                    <p>Mastery {session.mastery_index}%</p>
                  </div>
                  <div>
                    <p>Accuracy {session.accuracy_rate}%</p>
                    <p>{formatTimestamp(session.created_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel
            title="Platform Notes"
            subtitle="Operational context for the rebuilt intelligence stack."
          >
            <div className="notes-grid">
              <article className="note-card">
                <h3>Planning Engine</h3>
                <p>Planner Agent turns model output, graph context, temporal state, and experiments into branching mission plans.</p>
              </article>
              <article className="note-card">
                <h3>Temporal State</h3>
                <p>The learner model tracks mastery velocity, risk stability, path consistency, and intervention effectiveness over time.</p>
              </article>
              <article className="note-card">
                <h3>Knowledge Graph</h3>
                <p>Scenes, people, laws, and themes are linked locally so agents can reason over structure instead of flat documents alone.</p>
              </article>
              <article className="note-card">
                <h3>Evaluation Layer</h3>
                <p>Benchmark suites, experiment policies, and event logs make the local AI stack measurable instead of purely decorative.</p>
              </article>
            </div>
          </Panel>
        </section>
      </main>

      {(isBooting || isPending) ? <div className="loading-ribbon">Syncing warehouse...</div> : null}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: number | string | undefined
  suffix?: string
}) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value ?? '--'}{suffix}</strong>
    </article>
  )
}

function OpsPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <article className="ops-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function SnapshotCard({
  snapshot,
}: {
  snapshot: SnapshotSummary | null
}) {
  if (!snapshot) {
    return <div className="empty-state">No warehouse snapshot has been materialized yet.</div>
  }

  return (
    <div className="snapshot-card">
      <div className="snapshot-card-head">
        <div>
          <p className="mini-label">Latest snapshot</p>
          <h3>{formatTimestamp(snapshot.snapshot_at)}</h3>
        </div>
        <span className="snapshot-card-id">#{snapshot.id ?? snapshot.snapshot_id ?? 'n/a'}</span>
      </div>

      <div className="snapshot-card-grid">
        <div>
          <span>Learners</span>
          <strong>{snapshot.learner_count}</strong>
        </div>
        <div>
          <span>Avg mastery</span>
          <strong>{snapshot.average_mastery}%</strong>
        </div>
        <div>
          <span>Avg accuracy</span>
          <strong>{snapshot.average_accuracy}%</strong>
        </div>
        <div>
          <span>High risk share</span>
          <strong>{snapshot.high_risk_share}%</strong>
        </div>
      </div>

      <div className="snapshot-detail-list">
        {Object.entries(snapshot.details).map(([key, value]) => (
          <div key={key}>
            <span>{key.replaceAll('_', ' ')}</span>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentInsightCard({
  insight,
  tone = 'public',
}: {
  insight: AgentInsight
  tone?: 'public' | 'operations'
}) {
  return (
    <article className={`agent-card ${tone === 'operations' ? 'operations' : ''}`}>
      <div className="agent-head">
        <div>
          <p className="mini-label">{insight.role}</p>
          <h3>{insight.display_name}</h3>
        </div>
        <div className={`agent-priority priority-${insight.priority}`}>{insight.priority}</div>
      </div>

      <p className="agent-summary">{insight.summary}</p>

      <div className="agent-confidence">Confidence {insight.confidence.toFixed(1)}%</div>

      <div className="agent-columns">
        <div>
          <p className="mini-label">Signals</p>
          <ul className="dense-list narrative">
            {insight.signals.map(signal => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mini-label">Actions</p>
          <ul className="dense-list narrative">
            {insight.actions.map(action => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

function KnowledgeCard({
  document,
}: {
  document: KnowledgeDocument
}) {
  return (
    <article className="knowledge-card">
      <div className="knowledge-head">
        <div>
          <p className="mini-label">{document.era}</p>
          <h3>{document.title}</h3>
        </div>
        <div className="knowledge-score">{document.relevance.toFixed(1)}%</div>
      </div>

      <p className="knowledge-theme">{document.theme}</p>
      <p className="knowledge-summary">{document.summary}</p>
      <p className="knowledge-use">{document.teaching_use}</p>
    </article>
  )
}

function MemoryCard({
  entry,
}: {
  entry: AgentMemoryResponse['timeline'][number]
}) {
  return (
    <article className="memory-card">
      <div className="memory-head">
        <div>
          <p className="mini-label">{formatTimestamp(entry.created_at)}</p>
          <h3>{entry.display_name}</h3>
        </div>
        <div className={`agent-priority priority-${entry.priority}`}>{entry.priority}</div>
      </div>

      <p className="memory-summary-text">{entry.summary}</p>

      <div className="memory-meta">
        <span>Path {entry.predicted_path.replaceAll('_', ' ')}</span>
        <span>Risk {entry.risk_band}</span>
        <span>Scene {entry.scene_focus}</span>
        <span>Sources {entry.knowledge_document_ids.join(', ') || 'n/a'}</span>
      </div>
    </article>
  )
}

function DistributionList({
  items,
  tone,
}: {
  items: Array<{ label: string; count: number; share: number }>
  tone: 'warm' | 'cool'
}) {
  if (items.length === 0) {
    return <div className="empty-state">No cohort distribution is available yet.</div>
  }

  return (
    <div className="distribution-list">
      {items.map(item => (
        <div className="distribution-row" key={item.label}>
          <div className="distribution-meta">
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
          <div className={`distribution-bar tone-${tone}`}>
            <div style={{ width: `${item.share}%` }} />
          </div>
          <small>{item.share}%</small>
        </div>
      ))}
    </div>
  )
}

function TrendStrip({
  points,
}: {
  points: Array<{ day: string; mastery: number; accuracy: number; support_need: number }>
}) {
  if (points.length === 0) {
    return <div className="empty-state">Trend data will appear after the warehouse is populated.</div>
  }

  return (
    <div className="trend-strip">
      {points.map(point => (
        <article className="trend-card" key={point.day}>
          <span>{point.day}</span>
          <strong>{point.mastery}%</strong>
          <p>Accuracy {point.accuracy}%</p>
          <small>Support need {point.support_need}%</small>
        </article>
      ))}
    </div>
  )
}

function GraphContextCard({
  context,
}: {
  context: GraphContextResponse
}) {
  return (
    <div className="stack-tight">
      <div className="result-card tone-balanced">
        <div className="result-footer single-row">
          <span>Scene {context.scene_focus}</span>
          <span>Path {context.predicted_path.replaceAll('_', ' ')}</span>
        </div>
      </div>

      <div className="graph-grid">
        {context.nodes.map(node => (
          <article className="graph-card" key={node.id}>
            <span>{node.node_type}</span>
            <strong>{node.label}</strong>
          </article>
        ))}
      </div>

      <div className="two-column">
        <div>
          <p className="mini-label">Graph Highlights</p>
          <ul className="dense-list narrative">
            {context.highlights.map(highlight => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mini-label">Edges</p>
          <ul className="dense-list narrative">
            {context.edges.map(edge => (
              <li key={`${edge.source}-${edge.target}-${edge.relationship}`}>
                {edge.source} {edge.relationship} {edge.target}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function ExperimentRecommendationCard({
  recommendation,
}: {
  recommendation: ExperimentRecommendationResponse
}) {
  return (
    <div className="policy-card">
      <div className="workflow-head">
        <div>
          <span className="mini-label">Experiment policy</span>
          <h3>{recommendation.policy_label}</h3>
        </div>
        <span className="workflow-badge status-neutral">{recommendation.estimated_lift}% lift</span>
      </div>
      <p className="knowledge-summary">{recommendation.rationale}</p>
      <div className="snapshot-card-grid">
        <div>
          <span>Exploration</span>
          <strong>{recommendation.exploration_score}</strong>
        </div>
        <div>
          <span>Exploitation</span>
          <strong>{recommendation.exploitation_score}</strong>
        </div>
        <div>
          <span>Assigned</span>
          <strong>{formatTimestamp(recommendation.assigned_at)}</strong>
        </div>
      </div>
    </div>
  )
}

function MissionPlanCard({
  plan,
}: {
  plan: MissionPlanResponse
}) {
  return (
    <div className="stack-tight">
      <div className="result-card tone-balanced">
        <div className="result-header">
          <div>
            <p className="mini-label">Mission title</p>
            <h3>{plan.mission_title}</h3>
          </div>
          <div>
            <p className="mini-label">Target path</p>
            <h3>{plan.target_path.replaceAll('_', ' ')}</h3>
          </div>
          <div>
            <p className="mini-label">Generated</p>
            <h3>{formatTimestamp(plan.generated_at)}</h3>
          </div>
        </div>
        <p className="knowledge-summary">{plan.objective}</p>
      </div>

      <AgentInsightCard insight={plan.planner_agent} />

      <div className="subsection">
        <h3>Mission Steps</h3>
        <div className="mission-step-list">
          {plan.steps.map(step => (
            <article className="mission-step" key={step.step_number}>
              <div className="workflow-head">
                <div>
                  <span className="mini-label">Step {step.step_number}</span>
                  <h3>{step.title}</h3>
                </div>
                <span className="workflow-badge status-neutral">{step.duration_minutes} min</span>
              </div>
              <p>{step.purpose}</p>
              <div className="workflow-meta">
                <span>Agent {step.recommended_agent}</span>
                <span>Success {step.success_signal}</span>
              </div>
              <div className="memory-meta">
                {step.resources.map(resource => (
                  <span key={resource}>{resource}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="two-column">
        <div>
          <p className="mini-label">Checkpoints</p>
          <ul className="dense-list narrative">
            {plan.checkpoints.map(checkpoint => (
              <li key={checkpoint.name}>
                <strong>{checkpoint.name}</strong> {checkpoint.description} ({checkpoint.metric})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mini-label">Fallback Branches</p>
          <ul className="dense-list narrative">
            {plan.branches.map(branch => (
              <li key={`${branch.condition}-${branch.fallback_step}`}>
                {branch.condition} Fallback: {branch.fallback_step}.
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="mini-label">Completion Criteria</p>
        <ul className="dense-list narrative">
          {plan.completion_criteria.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ExperimentMetricsCard({
  metrics,
}: {
  metrics: ExperimentMetricsResponse
}) {
  return (
    <div className="stack-tight">
      <div className="result-card tone-balanced">
        <div className="result-footer single-row">
          <span>Total assignments {metrics.total_assignments}</span>
          <span>Policies tracked {metrics.policies.length}</span>
        </div>
      </div>
      <div className="knowledge-grid">
        {metrics.policies.map(policy => (
          <article className="knowledge-card" key={policy.policy_name}>
            <p className="mini-label">{policy.policy_name.replaceAll('_', ' ')}</p>
            <h3>{policy.policy_label}</h3>
            <div className="memory-meta">
              <span>Assignments {policy.assignment_count}</span>
              <span>Avg lift {policy.average_estimated_lift}%</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function EventPipelineCard({
  pipeline,
}: {
  pipeline: EventPipelineResponse
}) {
  return (
    <div className="stack-tight">
      <div className="result-card tone-balanced">
        <div className="result-footer single-row">
          <span>Total events {pipeline.total_events}</span>
          <span>Latest event {formatTimestamp(pipeline.latest_event_at)}</span>
        </div>
      </div>

      <div className="memory-meta">
        {pipeline.event_types.map(item => (
          <span key={item.event_type}>{item.event_type}: {item.count}</span>
        ))}
      </div>

      <div className="event-list">
        {pipeline.recent_events.map(event => (
          <article className="event-card" key={`${event.event_type}-${event.created_at}-${event.source}`}>
            <div className="workflow-head">
              <div>
                <h3>{event.event_type.replaceAll('_', ' ')}</h3>
                <p>{event.payload_preview || 'No payload preview available.'}</p>
              </div>
              <span className="workflow-badge status-neutral">{event.source}</span>
            </div>
            <div className="workflow-meta">
              <span>Learner {event.learner_id ?? 'system'}</span>
              <span>{formatTimestamp(event.created_at)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function BenchmarkReportCard({
  report,
}: {
  report: BenchmarkReportResponse
}) {
  return (
    <div className="stack-tight">
      <div className="result-card tone-balanced">
        <div className="result-footer single-row">
          <span>Overall score {report.overall_score}%</span>
          <span>Generated {formatTimestamp(report.generated_at)}</span>
        </div>
      </div>

      <div className="event-list">
        {report.benchmarks.map(benchmark => (
          <article className="event-card" key={benchmark.benchmark_name}>
            <div className="workflow-head">
              <div>
                <h3>{benchmark.benchmark_name.replaceAll('_', ' ')}</h3>
                <p>{benchmark.summary}</p>
              </div>
              <span className={`workflow-badge ${benchmarkStatusClassName(benchmark.status)}`}>
                {benchmark.status} {benchmark.score}%
              </span>
            </div>
          </article>
        ))}
      </div>

      <div>
        <p className="mini-label">Recommendations</p>
        <ul className="dense-list narrative">
          {report.recommendations.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field slider-field">
      <span>{label}</span>
      <div className="slider-header">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
        <strong>{value}</strong>
      </div>
    </label>
  )
}

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function buildEvaluationSnapshot(result: EvaluationResponse): AgentEvaluationSnapshot {
  return {
    predicted_path: result.predicted_path,
    risk_band: result.risk_band,
    confidence: result.confidence,
    cohort_label: result.cohort_label,
    suggested_scene_focus: result.suggested_scene_focus,
  }
}

function deriveEvaluationFromPlan(
  plan: MissionPlanResponse,
  currentResult: EvaluationResponse | null,
): AgentEvaluationSnapshot {
  if (currentResult) {
    return buildEvaluationSnapshot(currentResult)
  }

  return {
    predicted_path: plan.target_path,
    risk_band: plan.temporal_state.current_risk,
    confidence: plan.planner_agent.confidence,
    cohort_label: 'mission_sequence',
    suggested_scene_focus: plan.target_scene,
  }
}

function applyMissionState({
  plan,
  evaluation,
  memory,
  temporal,
  setMissionPlan,
  setExperimentRecommendation,
  setGraphContext,
  setTemporalState,
  setAgentRun,
  setAgentMemory,
}: {
  plan: MissionPlanResponse
  evaluation: AgentEvaluationSnapshot
  memory: AgentMemoryResponse
  temporal: TemporalLearnerState
  setMissionPlan: (value: MissionPlanResponse) => void
  setExperimentRecommendation: (value: ExperimentRecommendationResponse) => void
  setGraphContext: (value: GraphContextResponse) => void
  setTemporalState: (value: TemporalLearnerState) => void
  setAgentRun: (value: AgentRunResponse) => void
  setAgentMemory: (value: AgentMemoryResponse) => void
}) {
  setMissionPlan(plan)
  setExperimentRecommendation(plan.experiment_policy)
  setGraphContext(plan.graph_context)
  setTemporalState(temporal)
  setAgentRun({
    generated_at: plan.generated_at,
    evaluation,
    agents: plan.supporting_agents,
    knowledge_matches: plan.knowledge_matches,
    memory,
  })
  setAgentMemory(memory)
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

function formatWorkflowName(workflowName: string): string {
  return workflowName.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'n/a'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function formatSeconds(value: number | undefined): string {
  if (!value) {
    return 'n/a'
  }

  if (value < 60) {
    return `${value}s`
  }

  const minutes = Math.round(value / 60)
  return `${minutes}m`
}

function maskDatabaseUrl(databaseUrl: string): string {
  if (databaseUrl.startsWith('sqlite:///')) {
    const segments = databaseUrl.split('/')
    return `sqlite:///.../${segments.slice(-2).join('/')}`
  }

  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:••••@')
}

function statusClassName(status: string): string {
  if (status === 'success') {
    return 'status-success'
  }

  if (status === 'failed') {
    return 'status-failed'
  }

  return 'status-neutral'
}

function benchmarkStatusClassName(status: string): string {
  if (status === 'pass') {
    return 'status-success'
  }

  if (status === 'fail') {
    return 'status-failed'
  }

  return 'status-neutral'
}

export default App
