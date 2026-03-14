import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import './App.css'
import { ApiError, api } from './api'
import type {
  AdminStatusResponse,
  BenchmarkReportResponse,
  DesktopContext,
  EducationAgentCatalogEntry,
  EducationAgentRunResponse,
  EducationApproval,
  EducationAuditEntry,
  EducationClassroom,
  EducationOverview,
  EducationSafetyStatus,
  EduClawBootstrapResponse,
  EduClawOverview,
  HealthStatus,
  ProjectDraft,
  ProjectSummary,
  StudioAgentCatalogEntry,
  StudioArtifactBundle,
  StudioCompileResponse,
  StudioGraph,
  StudioOverview,
  StudioProject,
  StudioSampleProject,
  StudioSearchResult,
  StudioSystemStatus,
  StudioTemplate,
} from './types'

const DRAFT_STORAGE_KEY = 'civic-project-studio-draft'
const ADMIN_TOKEN_STORAGE_KEY = 'civic-project-studio-admin-token'
const ONBOARDING_STORAGE_KEY = 'civic-project-studio-onboarding-complete'
const CLASSROOM_ACCESS_STORAGE_KEY = 'civic-project-studio-classroom-access'

const defaultDraft: ProjectDraft = {
  title: 'Neighborhood Memory Archive',
  summary: 'A local-first civic project assembled from uploaded documents and community evidence.',
  topic: 'Neighborhood memory, public history, and local civic action',
  audience: 'Middle and high school students',
  goalsText: 'Explain the issue\nCurate source evidence\nBuild an interactive local project',
  rubricText: 'Evidence Quality\nClarity\nAudience Fit\nDesign\nRevision Quality',
  template_id: 'mlk-legacy-lab',
  local_mode: 'no-llm',
}

const defaultCredentials = {
  username: 'admin',
  password: 'mlk-admin-demo',
}

const defaultClassroomDraft = {
  title: 'Civics Period 3',
  subject: 'Civics',
  grade_band: 'Grades 8-10',
  teacher_name: 'Ms. Rivera',
  description: 'A bounded classroom workspace for local-first research, projects, and teacher review.',
  default_template_id: 'lesson-module',
  standardsText: 'C3 Inquiry\nSource Analysis',
}

const defaultStudentDraft = {
  name: 'Jordan Lee',
  grade_level: 'Grade 9',
  learningGoalsText: 'Use stronger evidence\nPractice citations',
  notes: 'Interested in local policy and community history.',
}

const defaultAssignmentDraft = {
  title: 'Water Justice Brief',
  summary: 'Investigate a civic issue with approved evidence and build a cited student project.',
  topic: 'Clean water access and local infrastructure',
  audience: 'Grade 9 students',
  template_id: 'research-portfolio',
  goalsText: 'Compare local evidence\nDraft an evidence-backed claim',
  rubricText: 'Evidence Quality\nCitation Accuracy\nClarity',
  standardsText: 'C3 Inquiry\nArgument Writing',
  due_date: '2026-04-15',
  local_mode: 'no-llm' as const,
}

const defaultEducationAgentDraft = {
  role: 'teacher' as const,
  agent_name: 'lesson-planner',
  prompt: 'Build a bounded classroom plan using only approved materials and teacher-reviewed steps.',
}

const defaultApprovalReview = {
  reviewer: 'Ms. Rivera',
  note: 'Teacher reviewed. Sensitive external actions still require manual handling.',
}

const defaultEduClawDraft = {
  school_name: 'Roosevelt High',
  classroom_title: 'Civics 2A',
  teacher_name: 'Ms. Rivera',
  subject: 'Civics',
  grade_band: 'Grades 9-10',
  description: 'EduClaw control plane for a bounded classroom runtime.',
  default_template_id: 'lesson-module',
  template_id: 'research-portfolio',
  assignment_title: 'Community Archive Brief',
  assignment_summary: 'Create a cited classroom-safe project from approved evidence.',
  topic: 'Community archives and local history',
  audience: 'Grade 10 students',
  goalsText: 'Use approved evidence\nBuild a cited brief',
  rubricText: 'Evidence Quality\nCitation Accuracy',
  standardsText: 'Source Analysis\nCivic Inquiry',
  due_date: '2026-04-20',
  local_mode: 'no-llm' as const,
}

type ClassroomAccessKeys = {
  teacher_access_key: string
  student_access_key: string
  reviewer_access_key: string
  issued_at: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [overview, setOverview] = useState<StudioOverview | null>(null)
  const [systemStatus, setSystemStatus] = useState<StudioSystemStatus | null>(null)
  const [desktopContext, setDesktopContext] = useState<DesktopContext | null>(null)
  const [templates, setTemplates] = useState<StudioTemplate[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [agentCatalog, setAgentCatalog] = useState<StudioAgentCatalogEntry[]>([])
  const [educationOverview, setEducationOverview] = useState<EducationOverview | null>(null)
  const [educationClassrooms, setEducationClassrooms] = useState<EducationClassroom[]>([])
  const [educationAgentCatalog, setEducationAgentCatalog] = useState<EducationAgentCatalogEntry[]>([])
  const [educationApprovals, setEducationApprovals] = useState<EducationApproval[]>([])
  const [educationAudit, setEducationAudit] = useState<EducationAuditEntry[]>([])
  const [educationSafety, setEducationSafety] = useState<EducationSafetyStatus | null>(null)
  const [educlawOverview, setEduclawOverview] = useState<EduClawOverview | null>(null)
  const [educlawDraft, setEduclawDraft] = useState(defaultEduClawDraft)
  const [educlawBootstrapResult, setEduclawBootstrapResult] = useState<EduClawBootstrapResponse | null>(null)
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [classroomAccessVault, setClassroomAccessVault] = useState<Record<string, ClassroomAccessKeys>>(() => {
    const saved = window.localStorage.getItem(CLASSROOM_ACCESS_STORAGE_KEY)
    if (!saved) {
      return {}
    }
    try {
      return JSON.parse(saved) as Record<string, ClassroomAccessKeys>
    } catch {
      return {}
    }
  })
  const [classroomDraft, setClassroomDraft] = useState(defaultClassroomDraft)
  const [studentDraft, setStudentDraft] = useState(defaultStudentDraft)
  const [assignmentDraft, setAssignmentDraft] = useState(defaultAssignmentDraft)
  const [educationAgentDraft, setEducationAgentDraft] = useState<{
    role: 'teacher' | 'student' | 'shared'
    agent_name: string
    prompt: string
  }>(defaultEducationAgentDraft)
  const [educationAgentResult, setEducationAgentResult] = useState<EducationAgentRunResponse | null>(null)
  const [approvalReview, setApprovalReview] = useState(defaultApprovalReview)
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string>('')
  const [project, setProject] = useState<StudioProject | null>(null)
  const [artifactBundle, setArtifactBundle] = useState<StudioArtifactBundle | null>(null)
  const [compileResult, setCompileResult] = useState<StudioCompileResponse | null>(null)
  const [graph, setGraph] = useState<StudioGraph | null>(null)
  const [searchResults, setSearchResults] = useState<StudioSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('local evidence civic strategy')
  const [draft, setDraft] = useState<ProjectDraft>(() => {
    const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!saved) {
      return defaultDraft
    }
    try {
      return JSON.parse(saved) as ProjectDraft
    } catch {
      return defaultDraft
    }
  })
  const [credentials, setCredentials] = useState(defaultCredentials)
  const [token, setToken] = useState(() => window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '')
  const [adminStatus, setAdminStatus] = useState<AdminStatusResponse | null>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(
    () => window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true',
  )
  const [importTitle, setImportTitle] = useState('')
  const [teacherComment, setTeacherComment] = useState({
    author: 'Teacher',
    criterion: '',
    body: '',
  })
  const [isPending, startTransition] = useTransition()

  const deferredHealth = useDeferredValue(health)
  const deferredOverview = useDeferredValue(overview)
  const deferredSystemStatus = useDeferredValue(systemStatus)
  const deferredDesktopContext = useDeferredValue(desktopContext)
  const deferredTemplates = useDeferredValue(templates)
  const deferredProjects = useDeferredValue(projects)
  const deferredEducationOverview = useDeferredValue(educationOverview)
  const deferredEducationClassrooms = useDeferredValue(educationClassrooms)
  const deferredEducationApprovals = useDeferredValue(educationApprovals)
  const deferredEducationAudit = useDeferredValue(educationAudit)
  const deferredEducationSafety = useDeferredValue(educationSafety)
  const deferredEduclawOverview = useDeferredValue(educlawOverview)
  const deferredEduclawBootstrapResult = useDeferredValue(educlawBootstrapResult)
  const deferredProject = useDeferredValue(project)
  const deferredArtifacts = useDeferredValue(artifactBundle)
  const deferredGraph = useDeferredValue(graph)
  const deferredSearchResults = useDeferredValue(searchResults)
  const deferredBenchmark = useDeferredValue(benchmark)
  const deferredAdminStatus = useDeferredValue(adminStatus)

  const refreshStudio = useEffectEvent(async (showBootRibbon = false) => {
    if (showBootRibbon) {
      setIsBooting(true)
    }

    setError(null)

    try {
      const [healthResponse, overviewResponse, systemStatusResponse, templateResponse, projectResponse, catalogResponse] = await Promise.all([
        api.health(),
        api.studioOverview(),
        api.studioSystemStatus(),
        api.studioTemplates(),
        api.studioProjects(),
        api.studioAgentCatalog(),
      ])

      startTransition(() => {
        setHealth(healthResponse)
        setOverview(overviewResponse)
        setSystemStatus(systemStatusResponse)
        setTemplates(templateResponse)
        setProjects(projectResponse)
        setAgentCatalog(catalogResponse)
      })

      if (!selectedProjectSlug && projectResponse.length > 0) {
        setSelectedProjectSlug(projectResponse[0].slug)
      }
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'Failed to load Civic Project Studio.'))
    } finally {
      if (showBootRibbon) {
        setIsBooting(false)
      }
    }
  })

  const refreshEducation = useEffectEvent(async () => {
    try {
      const [overviewResponse, classroomResponse, agentResponse, safetyResponse] = await Promise.all([
        api.educationOverview(),
        api.educationClassrooms(),
        api.educationAgentCatalog(),
        api.educationSafety(),
      ])
      const activeClassroomId = selectedClassroomId || classroomResponse[0]?.classroom_id || ''
      const activeKeys = activeClassroomId ? classroomAccessVault[activeClassroomId] : undefined
      let approvalResponse: EducationApproval[] = []
      let auditEntries: EducationAuditEntry[] = []

      if (activeClassroomId && activeKeys) {
        const [approvalsResponse, auditResponse] = await Promise.all([
          api.educationApprovals(activeClassroomId, activeKeys.reviewer_access_key || activeKeys.teacher_access_key),
          api.educationAudit(activeClassroomId, activeKeys.teacher_access_key || activeKeys.reviewer_access_key),
        ])
        approvalResponse = approvalsResponse
        auditEntries = auditResponse.entries
      }

      startTransition(() => {
        setEducationOverview(overviewResponse)
        setEducationClassrooms(classroomResponse)
        setEducationAgentCatalog(agentResponse)
        setEducationApprovals(approvalResponse)
        setEducationAudit(auditEntries)
        setEducationSafety(safetyResponse)
      })

      if (!selectedClassroomId && classroomResponse.length > 0) {
        setSelectedClassroomId(classroomResponse[0].classroom_id)
      }
    } catch (educationError) {
      setError(getErrorMessage(educationError, 'Failed to load Education OS.'))
    }
  })

  const refreshEduClaw = useEffectEvent(async () => {
    try {
      const overviewResponse = await api.educlawOverview()
      startTransition(() => {
        setEduclawOverview(overviewResponse)
      })
    } catch (educlawError) {
      setError(getErrorMessage(educlawError, 'Failed to load EduClaw.'))
    }
  })

  const loadDesktopContext = useEffectEvent(async () => {
    if (!window.civicStudioDesktop?.getContext) {
      return
    }
    try {
      const context = await window.civicStudioDesktop.getContext()
      startTransition(() => {
        setDesktopContext(context)
      })
    } catch {}
  })

  const loadProject = useEffectEvent(async (slug: string) => {
    if (!slug) {
      return
    }

    setError(null)

    try {
      const [projectResponse, graphResponse] = await Promise.all([
        api.getProject(slug),
        api.projectGraph(slug),
      ])

      let artifactResponse: StudioArtifactBundle | null = null
      try {
        artifactResponse = await api.projectArtifacts(slug)
      } catch (artifactError) {
        if (!(artifactError instanceof ApiError && artifactError.status === 404)) {
          throw artifactError
        }
      }

      startTransition(() => {
        setProject(projectResponse)
        setGraph(graphResponse)
        setArtifactBundle(artifactResponse)
      })
    } catch (projectError) {
      setError(getErrorMessage(projectError, 'Failed to load the selected project.'))
    }
  })

  const refreshAdmin = useEffectEvent(async (activeToken: string) => {
    if (!activeToken) {
      return
    }

    setAuthError(null)

    try {
      const [statusResponse, benchmarkResponse] = await Promise.all([
        api.adminStatus(activeToken),
        api.latestBenchmark(activeToken),
      ])

      startTransition(() => {
        setAdminStatus(statusResponse)
        setBenchmark(benchmarkResponse)
      })
    } catch (adminError) {
      if (isUnauthorized(adminError)) {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
        startTransition(() => {
          setToken('')
          setAdminStatus(null)
          setBenchmark(null)
        })
        setAuthError('Admin session expired. Log in again.')
        return
      }

      if (!(adminError instanceof ApiError && adminError.status === 404)) {
        setAuthError(getErrorMessage(adminError, 'Failed to load admin operations.'))
      }
    }
  })

  useEffect(() => {
    void refreshStudio(true)
  }, [])

  useEffect(() => {
    void refreshEducation()
  }, [])

  useEffect(() => {
    void refreshEduClaw()
  }, [])

  useEffect(() => {
    void loadDesktopContext()
  }, [])

  useEffect(() => {
    if (!window.civicStudioDesktop?.onStateChanged) {
      return undefined
    }
    return window.civicStudioDesktop.onStateChanged((context) => {
      startTransition(() => {
        setDesktopContext(context)
      })
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, String(isOnboardingComplete))
  }, [isOnboardingComplete])

  useEffect(() => {
    window.localStorage.setItem(CLASSROOM_ACCESS_STORAGE_KEY, JSON.stringify(classroomAccessVault))
  }, [classroomAccessVault])

  useEffect(() => {
    if (!selectedProjectSlug) {
      return
    }
    void loadProject(selectedProjectSlug)
  }, [selectedProjectSlug])

  useEffect(() => {
    if (!desktopContext?.pendingProjectSlug) {
      return
    }
    setSelectedProjectSlug(desktopContext.pendingProjectSlug)
    void window.civicStudioDesktop?.consumePendingProject?.(desktopContext.pendingProjectSlug)
  }, [desktopContext?.pendingProjectSlug])

  useEffect(() => {
    if (!desktopContext?.recovery.unclean_exit) {
      return
    }
    setNotice('Recovered the desktop session after an unexpected shutdown.')
  }, [desktopContext?.recovery.unclean_exit])

  useEffect(() => {
    if (!desktopContext?.recovery.imported_project_slug || !desktopContext.recovery.imported_path) {
      return
    }
    setNotice(`Imported ${desktopContext.recovery.imported_path} and restored the project locally.`)
  }, [desktopContext?.recovery.imported_path, desktopContext?.recovery.imported_project_slug])

  useEffect(() => {
    if (!project?.slug || !window.civicStudioDesktop?.trackProject) {
      return
    }
    void window.civicStudioDesktop.trackProject({
      slug: project.slug,
      title: project.title,
    })
  }, [project?.slug, project?.title])

  useEffect(() => {
    if (!selectedClassroomId) {
      return
    }
    void refreshEducation()
  }, [classroomAccessVault, selectedClassroomId])

  useEffect(() => {
    if (!token) {
      startTransition(() => {
        setAdminStatus(null)
        setBenchmark(null)
      })
      return
    }
    void refreshAdmin(token)
  }, [token])

  useEffect(() => {
    if (!selectedClassroomId) {
      return
    }

    const classroom = educationClassrooms.find(item => item.classroom_id === selectedClassroomId)
    if (!classroom) {
      return
    }

    if (!selectedAssignmentId || !classroom.assignments.some(item => item.assignment_id === selectedAssignmentId)) {
      setSelectedAssignmentId(classroom.assignments[0]?.assignment_id ?? '')
    }
    if (!selectedStudentId || !classroom.students.some(item => item.student_id === selectedStudentId)) {
      setSelectedStudentId(classroom.students[0]?.student_id ?? '')
    }
  }, [educationClassrooms, selectedAssignmentId, selectedClassroomId, selectedStudentId])

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const created = await api.createProject({
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        topic: draft.topic.trim(),
        audience: draft.audience.trim(),
        goals: linesToArray(draft.goalsText),
        rubric: linesToArray(draft.rubricText),
        template_id: draft.template_id,
        local_mode: draft.local_mode,
      })

      await refreshStudio(false)
      setSelectedProjectSlug(created.slug)
      setNotice(`Created ${created.title}.`)
    } catch (createError) {
      setError(getErrorMessage(createError, 'Failed to create the project.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function saveProjectEdits() {
    if (!project) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const updated = await api.updateProject(project.slug, {
        title: project.title,
        summary: project.summary,
        topic: project.topic,
        audience: project.audience,
        goals: project.goals,
        rubric: project.rubric,
        local_mode: project.local_mode,
        sections: project.sections,
        workflow: project.workflow,
        theme_tokens: project.theme_tokens,
      })
      await refreshStudio(false)
      startTransition(() => {
        setProject(updated)
      })
      setNotice(`Saved ${updated.title}.`)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save the project manifest.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function compileProject() {
    if (!project) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const compiled = await api.compileProject(project.slug, project.workflow.stages)
      await refreshStudio(false)
      startTransition(() => {
        setCompileResult(compiled)
        setProject(compiled.project)
        setArtifactBundle(compiled.artifacts)
        setGraph(compiled.knowledge_graph)
        setSearchResults(compiled.retrieval_results)
      })
      if (token) {
        await refreshAdmin(token)
      }
      setNotice(`Compiled ${compiled.project.title} into ${compiled.exports.length} local exports.`)
    } catch (compileError) {
      setError(getErrorMessage(compileError, 'Failed to compile the project.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function runSearch() {
    if (!project) {
      return
    }

    setIsWorking(true)
    setError(null)

    try {
      const results = await api.searchProject(project.slug, searchQuery, 8)
      startTransition(() => {
        setSearchResults(results)
      })
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Failed to search project evidence.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function uploadDocuments(event: ChangeEvent<HTMLInputElement>) {
    if (!project || !event.target.files?.length) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      for (const file of Array.from(event.target.files)) {
        await api.uploadDocument(project.slug, file)
      }
      await loadProject(project.slug)
      await refreshStudio(false)
      setNotice(`Uploaded ${event.target.files.length} document${event.target.files.length === 1 ? '' : 's'}.`)
      event.target.value = ''
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, 'Failed to upload one or more documents.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function cloneProject() {
    if (!project) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const cloned = await api.cloneProject(project.slug, `${project.title} Clone`)
      await refreshStudio(false)
      setSelectedProjectSlug(cloned.slug)
      setNotice(`Cloned project to ${cloned.title}.`)
    } catch (cloneError) {
      setError(getErrorMessage(cloneError, 'Failed to clone the project.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function importProjectBundle(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const imported = await api.importProject(file, importTitle.trim())
      await refreshStudio(false)
      setSelectedProjectSlug(imported.slug)
      setNotice(`Imported backup as ${imported.title}.`)
      setImportTitle('')
      event.target.value = ''
    } catch (importError) {
      setError(getErrorMessage(importError, 'Failed to import the project bundle.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function submitTeacherComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const updated = await api.addTeacherComment(project.slug, teacherComment)
      startTransition(() => {
        setProject(updated)
      })
      await refreshStudio(false)
      setTeacherComment({ author: teacherComment.author, criterion: '', body: '' })
      setNotice('Teacher comment saved to the project timeline.')
    } catch (commentError) {
      setError(getErrorMessage(commentError, 'Failed to save the teacher comment.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const classroom = await api.createClassroom({
        ...classroomDraft,
        standards_focus: linesToArray(classroomDraft.standardsText),
      })
      storeClassroomAccess(classroom)
      await refreshEducation()
      setSelectedClassroomId(classroom.classroom_id)
      setNotice(`Created classroom ${classroom.title}. Local access keys were stored on this device.`)
    } catch (classroomError) {
      setError(getErrorMessage(classroomError, 'Failed to create the classroom.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function enrollStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedClassroomId) {
      return
    }
    const teacherAccessKey = requireClassroomAccess(selectedClassroomId, 'teacher')
    if (!teacherAccessKey) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const classroom = await api.enrollStudent(selectedClassroomId, {
        name: studentDraft.name.trim(),
        grade_level: studentDraft.grade_level.trim(),
        learning_goals: linesToArray(studentDraft.learningGoalsText),
        notes: studentDraft.notes.trim(),
        access_key: teacherAccessKey,
      })
      await refreshEducation()
      setSelectedClassroomId(classroom.classroom_id)
      setSelectedStudentId(classroom.students[classroom.students.length - 1]?.student_id ?? selectedStudentId)
      setNotice(`Enrolled ${studentDraft.name}.`)
    } catch (studentError) {
      setError(getErrorMessage(studentError, 'Failed to enroll the student.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedClassroomId) {
      return
    }
    const teacherAccessKey = requireClassroomAccess(selectedClassroomId, 'teacher')
    if (!teacherAccessKey) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const classroom = await api.createAssignment(selectedClassroomId, {
        title: assignmentDraft.title.trim(),
        summary: assignmentDraft.summary.trim(),
        topic: assignmentDraft.topic.trim(),
        audience: assignmentDraft.audience.trim(),
        template_id: assignmentDraft.template_id,
        goals: linesToArray(assignmentDraft.goalsText),
        rubric: linesToArray(assignmentDraft.rubricText),
        standards: linesToArray(assignmentDraft.standardsText),
        due_date: assignmentDraft.due_date.trim(),
        local_mode: assignmentDraft.local_mode,
        access_key: teacherAccessKey,
      })
      await refreshEducation()
      setSelectedClassroomId(classroom.classroom_id)
      setSelectedAssignmentId(classroom.assignments[classroom.assignments.length - 1]?.assignment_id ?? selectedAssignmentId)
      setNotice(`Created assignment ${assignmentDraft.title}.`)
    } catch (assignmentError) {
      setError(getErrorMessage(assignmentError, 'Failed to create the assignment.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function uploadClassroomMaterials(event: ChangeEvent<HTMLInputElement>) {
    if (!selectedClassroomId || !event.target.files?.length) {
      return
    }
    const teacherAccessKey = requireClassroomAccess(selectedClassroomId, 'teacher')
    if (!teacherAccessKey) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      for (const file of Array.from(event.target.files)) {
        await api.uploadClassroomMaterial(selectedClassroomId, file, teacherAccessKey, selectedAssignmentId)
      }
      await refreshEducation()
      setNotice(`Uploaded ${event.target.files.length} classroom material${event.target.files.length === 1 ? '' : 's'}.`)
      event.target.value = ''
    } catch (materialError) {
      setError(getErrorMessage(materialError, 'Failed to upload classroom material.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function launchStudentProject() {
    if (!selectedClassroomId || !selectedAssignmentId || !selectedStudentId) {
      return
    }
    const teacherAccessKey = requireClassroomAccess(selectedClassroomId, 'teacher')
    if (!teacherAccessKey) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const launch = await api.launchStudentProject(selectedClassroomId, {
        assignment_id: selectedAssignmentId,
        student_id: selectedStudentId,
        access_key: teacherAccessKey,
      })
      await refreshEducation()
      await refreshStudio(false)
      setSelectedClassroomId(launch.classroom.classroom_id)
      setSelectedProjectSlug(launch.project.slug)
      startTransition(() => {
        setProject(launch.project)
      })
      setNotice(`Launched ${launch.project.title} with ${launch.seeded_material_count} approved classroom materials.`)
    } catch (launchError) {
      setError(getErrorMessage(launchError, 'Failed to launch the student project.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function runEducationAgent() {
    if (!selectedClassroomId) {
      return
    }
    const accessKey = requireRoleAccess(selectedClassroomId, educationAgentDraft.role)
    if (!accessKey) {
      return
    }

    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const result = await api.runEducationAgent({
        role: educationAgentDraft.role,
        agent_name: educationAgentDraft.agent_name,
        classroom_id: selectedClassroomId,
        assignment_id: selectedAssignmentId || undefined,
        student_id: selectedStudentId || undefined,
        project_slug: selectedProjectSlug || undefined,
        access_key: accessKey,
        prompt: educationAgentDraft.prompt.trim(),
      })
      await refreshEducation()
      startTransition(() => {
        setEducationAgentResult(result)
      })
      setNotice(result.requires_approval ? 'Agent run completed and queued a sensitive action for approval.' : 'Education agent run completed.')
    } catch (agentError) {
      setError(getErrorMessage(agentError, 'Failed to run the education agent.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function resolveApproval(approvalId: string, decision: 'approved' | 'rejected') {
    if (!selectedClassroomId) {
      return
    }
    const accessKey = requireRoleAccess(selectedClassroomId, 'shared')
    if (!accessKey) {
      return
    }
    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      await api.resolveEducationApproval(approvalId, {
        decision,
        reviewer: approvalReview.reviewer.trim(),
        note: approvalReview.note.trim(),
        access_key: accessKey,
      })
      await refreshEducation()
      setNotice(`Approval ${decision}.`)
    } catch (approvalError) {
      setError(getErrorMessage(approvalError, 'Failed to resolve the approval request.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function bootstrapEduClaw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsWorking(true)
    setError(null)
    setNotice(null)

    try {
      const result = await api.educlawBootstrap({
        school_name: educlawDraft.school_name.trim(),
        classroom_title: educlawDraft.classroom_title.trim(),
        teacher_name: educlawDraft.teacher_name.trim(),
        subject: educlawDraft.subject.trim(),
        grade_band: educlawDraft.grade_band.trim(),
        description: educlawDraft.description.trim(),
        default_template_id: educlawDraft.default_template_id,
        template_id: educlawDraft.template_id,
        assignment_title: educlawDraft.assignment_title.trim(),
        assignment_summary: educlawDraft.assignment_summary.trim(),
        topic: educlawDraft.topic.trim(),
        audience: educlawDraft.audience.trim(),
        goals: linesToArray(educlawDraft.goalsText),
        rubric: linesToArray(educlawDraft.rubricText),
        standards_focus: linesToArray(educlawDraft.standardsText),
        due_date: educlawDraft.due_date.trim(),
        local_mode: educlawDraft.local_mode,
      })
      storeClassroomAccess(result.classroom)
      await Promise.all([refreshEduClaw(), refreshEducation(), refreshStudio(false)])
      setSelectedClassroomId(result.classroom.classroom_id)
      setSelectedAssignmentId(result.assignment.assignment_id)
      startTransition(() => {
        setEduclawBootstrapResult(result)
      })
      setNotice(`Bootstrapped EduClaw for ${result.classroom.title}. Signed control plane and local classroom keys are ready.`)
    } catch (bootstrapError) {
      setError(getErrorMessage(bootstrapError, 'Failed to bootstrap EduClaw.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsWorking(true)
    setAuthError(null)

    try {
      const session = await api.login(credentials)
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, session.access_token)
      startTransition(() => {
        setToken(session.access_token)
      })
      setNotice(`Admin session active until ${formatTimestamp(session.expires_at)}.`)
    } catch (loginError) {
      setAuthError(getErrorMessage(loginError, 'Admin login failed.'))
    } finally {
      setIsWorking(false)
    }
  }

  function logout() {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    startTransition(() => {
      setToken('')
      setAdminStatus(null)
      setBenchmark(null)
    })
    setNotice('Admin session cleared.')
  }

  function updateDraftField<K extends keyof ProjectDraft>(field: K, value: ProjectDraft[K]) {
    setDraft(current => ({ ...current, [field]: value }))
  }

  function updateProjectField<K extends keyof StudioProject>(field: K, value: StudioProject[K]) {
    setProject(current => (current ? { ...current, [field]: value } : current))
  }

  function updateEducationAgentRole(role: 'teacher' | 'student' | 'shared') {
    const firstAgent = educationAgentCatalog.find(agent => agent.role === role)
    setEducationAgentDraft(current => ({
      ...current,
      role,
      agent_name: firstAgent?.name ?? current.agent_name,
    }))
  }

  function updateProjectTextList(field: 'goals' | 'rubric', value: string) {
    setProject(current => (current ? { ...current, [field]: linesToArray(value) } : current))
  }

  function toggleWorkflowStage(stageId: string) {
    setProject(current => {
      if (!current) {
        return current
      }

      return {
        ...current,
        workflow: {
          stages: current.workflow.stages.map(stage =>
            stage.stage_id === stageId ? { ...stage, enabled: !stage.enabled } : stage,
          ),
        },
      }
    })
  }

  const selectedTemplate = deferredTemplates.find(template => template.id === draft.template_id) ?? deferredTemplates[0] ?? null
  const adminReady = token.length > 0
  const compileArtifacts = compileResult?.artifacts ?? deferredArtifacts
  const exports = deferredProject?.exports ?? []
  const bundleExport = exports.find(exportEntry => exportEntry.export_type === 'project_bundle')
  const rubricExport = exports.find(exportEntry => exportEntry.export_type === 'rubric_report')
  const teacherComments = deferredProject?.teacher_comments ?? []
  const standardsAlignment = deferredProject?.standards_alignment ?? []
  const revisionHistory = deferredProject?.revision_history ?? []
  const selectedClassroom = deferredEducationClassrooms.find(item => item.classroom_id === selectedClassroomId) ?? null
  const selectedAssignment = selectedClassroom?.assignments.find(item => item.assignment_id === selectedAssignmentId) ?? null
  const selectedStudent = selectedClassroom?.students.find(item => item.student_id === selectedStudentId) ?? null
  const selectedClassroomKeys = selectedClassroomId ? classroomAccessVault[selectedClassroomId] : undefined
  const filteredEducationAgents = educationAgentCatalog.filter(agent => agent.role === educationAgentDraft.role)
  const educlawAllowedChannels = ((deferredEduclawOverview?.derived_control_plane.allowed_channels as string[] | undefined) ?? [])
  const educlawDeniedTools = ((deferredEduclawOverview?.derived_control_plane.denied_tools as string[] | undefined) ?? [])
  const educlawAttestation = (deferredEduclawBootstrapResult?.control_plane.security as Record<string, unknown> | undefined) ?? undefined

  function applySampleProject(sample: StudioSampleProject) {
    setDraft(current => ({
      ...current,
      title: sample.title,
      summary: sample.summary,
      topic: sample.title,
      template_id: sample.template_id,
    }))
    setNotice(`Loaded sample starter: ${sample.title}.`)
  }

  async function chooseWorkspace() {
    if (!window.civicStudioDesktop?.chooseWorkspace) {
      return
    }
    const context = await window.civicStudioDesktop.chooseWorkspace()
    startTransition(() => {
      setDesktopContext(context)
    })
    await refreshStudio(false)
    setNotice(`Workspace set to ${context.workspaceRoot}.`)
  }

  async function openWorkspace() {
    await window.civicStudioDesktop?.openWorkspace?.()
  }

  async function openReleaseNotes() {
    await window.civicStudioDesktop?.openReleaseNotes?.()
  }

  async function checkForUpdates() {
    if (!window.civicStudioDesktop?.checkForUpdates) {
      return
    }
    const context = await window.civicStudioDesktop.checkForUpdates()
    startTransition(() => {
      setDesktopContext(context)
    })
  }

  async function installDownloadedUpdate() {
    await window.civicStudioDesktop?.installUpdate?.()
  }

  async function toggleLaunchAtLogin() {
    if (!window.civicStudioDesktop?.setLaunchAtLogin || !desktopContext) {
      return
    }
    const context = await window.civicStudioDesktop.setLaunchAtLogin(!desktopContext.preferences.launchAtLogin)
    startTransition(() => {
      setDesktopContext(context)
    })
  }

  async function installToApplications() {
    if (!window.civicStudioDesktop?.installToApplications) {
      return
    }
    const context = await window.civicStudioDesktop.installToApplications()
    startTransition(() => {
      setDesktopContext(context)
    })
  }

  function openRecentProject(slug: string) {
    setSelectedProjectSlug(slug)
    setNotice(`Opened recent project ${slug}.`)
  }

  function storeClassroomAccess(classroom: EducationClassroom) {
    const bootstrap = classroom.security_bootstrap
    if (!bootstrap) {
      return
    }
    setClassroomAccessVault(current => ({
      ...current,
      [classroom.classroom_id]: {
        teacher_access_key: bootstrap.teacher_access_key,
        student_access_key: bootstrap.student_access_key,
        reviewer_access_key: bootstrap.reviewer_access_key,
        issued_at: bootstrap.issued_at,
      },
    }))
  }

  function requireClassroomAccess(classroomId: string, role: 'teacher' | 'student' | 'reviewer'): string | null {
    const keys = classroomAccessVault[classroomId]
    const accessKey =
      role === 'teacher'
        ? keys?.teacher_access_key
        : role === 'student'
          ? keys?.student_access_key
          : keys?.reviewer_access_key
    if (accessKey) {
      return accessKey
    }
    setError(`Missing local ${role} access key for this classroom. Re-bootstrap or recreate the classroom on this device.`)
    return null
  }

  function requireRoleAccess(classroomId: string, role: 'teacher' | 'student' | 'shared'): string | null {
    const keys = classroomAccessVault[classroomId]
    if (role === 'teacher') {
      return requireClassroomAccess(classroomId, 'teacher')
    }
    if (role === 'student') {
      return keys?.student_access_key || requireClassroomAccess(classroomId, 'teacher')
    }
    return keys?.reviewer_access_key || requireClassroomAccess(classroomId, 'teacher')
  }

  return (
    <div className="studio-shell">
      <div className="glow glow-left" />
      <div className="glow glow-right" />

      <main className="studio-dashboard">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Civic Project Studio</p>
            <h1>Upload sources, choose a template, and locally build a cited, editable project operating system.</h1>
            <p className="hero-text">
              This platform generalizes the original MLK project into a reusable local-first studio with manifests,
              document ingestion, provenance, agent artifacts, workflow compilation, and export bundles. The legacy
              experience is still preserved alongside the new engine.
            </p>

            <div className="hero-tags">
              {(deferredOverview?.install_modes ?? []).map(mode => (
                <span className="hero-tag" key={String(mode.mode)}>
                  {String(mode.mode).replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-actions">
            <div className={`status-pill ${deferredHealth?.trained ? 'trained' : 'neutral'}`}>
              <span className="status-dot" />
              {deferredHealth?.app ?? 'Civic Project Studio'}
            </div>
            <div className="status-pill neutral">
              <span className="status-dot" />
              DB {deferredHealth?.database_backend ?? 'pending'}
            </div>
            <div className="status-pill neutral">
              <span className="status-dot" />
              v{deferredSystemStatus?.release.desktop_version ?? '0.2.0'}
            </div>
            <div className="status-pill neutral">
              <span className="status-dot" />
              {deferredSystemStatus?.local_ai.ollama_reachable ? 'Local AI ready' : 'No local AI runtime'}
            </div>
            <button className="action-button secondary" onClick={() => void refreshStudio(false)} disabled={isWorking}>
              Refresh Studio
            </button>
            {deferredProject ? (
              <button className="action-button" onClick={() => void compileProject()} disabled={isWorking}>
                Compile Project
              </button>
            ) : null}
            {deferredProject ? (
              <button className="action-button dark" onClick={() => void cloneProject()} disabled={isWorking}>
                Duplicate Project
              </button>
            ) : null}
            {deferredDesktopContext ? (
              <button className="text-button" type="button" onClick={() => void chooseWorkspace()}>
                Choose Workspace
              </button>
            ) : null}
            {deferredDesktopContext ? (
              <button className="text-button" type="button" onClick={() => void openWorkspace()}>
                Open Workspace
              </button>
            ) : null}
            {deferredDesktopContext ? (
              <button className="text-button" type="button" onClick={() => void openReleaseNotes()}>
                Release Notes
              </button>
            ) : null}
            {deferredDesktopContext ? (
              <button className="text-button" type="button" onClick={() => void checkForUpdates()}>
                Check Updates
              </button>
            ) : null}
            {deferredDesktopContext ? (
              <button className="text-button" type="button" onClick={() => void toggleLaunchAtLogin()}>
                {deferredDesktopContext.preferences.launchAtLogin ? 'Disable Login Launch' : 'Enable Login Launch'}
              </button>
            ) : null}
            {deferredDesktopContext?.canInstallToApplications ? (
              <button className="text-button" type="button" onClick={() => void installToApplications()}>
                Install to Applications
              </button>
            ) : null}
            {deferredDesktopContext?.updater.status === 'downloaded' ? (
              <button className="text-button" type="button" onClick={() => void installDownloadedUpdate()}>
                Install Update
              </button>
            ) : null}
            <a className="legacy-link" href={api.legacyUrl()} target="_blank" rel="noreferrer">
              Open Preserved Legacy HTML
            </a>
          </div>
        </section>

        {!isOnboardingComplete ? (
          <Panel title="First-Run Onboarding" subtitle="Pick a workspace, inspect runtime health, choose a sample starter, and confirm the local-first setup.">
            <div className="stack-tight">
              <div className="preview-card embedded">
                <div className="preview-topline">
                  <div>
                    <span className="mini-label">Workspace</span>
                    <h3>{deferredDesktopContext?.workspaceRoot ?? deferredSystemStatus?.workspace_root ?? 'Local workspace pending'}</h3>
                  </div>
                  <span className="pill">{String((deferredSystemStatus?.startup.state ?? 'pending')).replaceAll('_', ' ')}</span>
                </div>
                <div className="chip-row">
                  <span className="chip">Warmup {(deferredSystemStatus?.startup.state as string | undefined) ?? 'pending'}</span>
                  <span className="chip">
                    OCR {deferredSystemStatus?.tools.tesseract_available ? 'ready' : 'not detected'}
                  </span>
                  <span className="chip">
                    Local AI {deferredSystemStatus?.local_ai.ollama_reachable ? 'reachable' : 'offline'}
                  </span>
                  <span className="chip">
                    Models {deferredSystemStatus?.local_ai.available_models.length ?? 0}
                  </span>
                  <span className="chip">
                    Updates {deferredDesktopContext?.updater.status ?? 'n/a'}
                  </span>
                  <span className="chip">
                    Launch at login {deferredDesktopContext?.preferences.launchAtLogin ? 'on' : 'off'}
                  </span>
                </div>
                <div className="action-row">
                  {deferredDesktopContext ? (
                    <button className="action-button secondary" type="button" onClick={() => void chooseWorkspace()}>
                      Choose Desktop Workspace
                    </button>
                  ) : null}
                  {deferredDesktopContext ? (
                    <button className="text-button dark-on-light" type="button" onClick={() => void openWorkspace()}>
                      Open Workspace Folder
                    </button>
                  ) : null}
                  {deferredDesktopContext ? (
                    <button className="text-button dark-on-light" type="button" onClick={() => void openReleaseNotes()}>
                      Open Release Notes
                    </button>
                  ) : null}
                  {deferredDesktopContext ? (
                    <button className="text-button dark-on-light" type="button" onClick={() => void toggleLaunchAtLogin()}>
                      {deferredDesktopContext.preferences.launchAtLogin ? 'Disable Launch at Login' : 'Enable Launch at Login'}
                    </button>
                  ) : null}
                  {deferredDesktopContext?.canInstallToApplications ? (
                    <button className="text-button dark-on-light" type="button" onClick={() => void installToApplications()}>
                      Install to Applications
                    </button>
                  ) : null}
                </div>
                {deferredDesktopContext ? <p className="mini-label">{deferredDesktopContext.updater.message}</p> : null}
              </div>

              {deferredDesktopContext?.recentProjects.length ? (
                <div className="preview-card embedded">
                  <div className="preview-topline">
                    <div>
                      <span className="mini-label">Recent desktop work</span>
                      <h3>Open Recent Projects</h3>
                    </div>
                    <span className="pill">{deferredDesktopContext.recentProjects.length}</span>
                  </div>
                  <div className="card-grid compact">
                    {deferredDesktopContext.recentProjects.slice(0, 4).map((item) => (
                      <article className="mini-card" key={item.slug}>
                        <h3>{item.title}</h3>
                        <p>{item.slug}</p>
                        <button className="text-button dark-on-light" type="button" onClick={() => openRecentProject(item.slug)}>
                          Open
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="card-grid compact">
                {(deferredOverview?.sample_projects ?? []).map(sample => (
                  <article className="mini-card" key={sample.slug}>
                    <h3>{sample.title}</h3>
                    <p>{sample.summary}</p>
                    <button className="text-button dark-on-light" type="button" onClick={() => applySampleProject(sample)}>
                      Use Sample Starter
                    </button>
                  </article>
                ))}
              </div>

              <div className="action-row">
                <button className="action-button" type="button" onClick={() => setIsOnboardingComplete(true)}>
                  Finish Onboarding
                </button>
              </div>
            </div>
          </Panel>
        ) : null}

        {error ? <section className="error-banner">{error}</section> : null}
        {authError ? <section className="error-banner">{authError}</section> : null}
        {notice ? <section className="notice-banner">{notice}</section> : null}

        <section className="metric-grid">
          <MetricCard label="Templates" value={deferredOverview?.counts.templates} />
          <MetricCard label="Projects" value={deferredOverview?.counts.projects} />
          <MetricCard label="Documents" value={deferredOverview?.counts.documents} />
          <MetricCard label="Exports" value={deferredOverview?.counts.exports} />
          <MetricCard label="Plugins" value={deferredOverview?.counts.plugins} />
          <MetricCard label="Benchmark Cadence" value={formatSeconds(deferredHealth?.scheduler.benchmark_interval_seconds)} />
        </section>

        <Panel title="EduClaw" subtitle="OpenClaw-derived control plane for bounded teacher and student orchestration.">
          <div className="two-up">
            <div className="subpanel">
              <div className="preview-topline">
                <div>
                  <span className="mini-label">Imported source</span>
                  <h3>{deferredEduclawOverview?.source_summary.package_name || 'openclaw source pending'}</h3>
                </div>
                <span className="pill">
                  {deferredEduclawOverview?.source_summary.available ? `v${deferredEduclawOverview.source_summary.version}` : 'missing'}
                </span>
              </div>
              <p>{deferredEduclawOverview?.tagline ?? 'EduClaw turns the OpenClaw product shape into a school-safe local-first system.'}</p>
              <div className="chip-row">
                <span className="chip">License {deferredEduclawOverview?.source_summary.license || 'n/a'}</span>
                <span className="chip">Node {deferredEduclawOverview?.source_summary.node_requirement || 'n/a'}</span>
                <span className="chip">Channels {deferredEduclawOverview?.source_summary.counts.channels ?? 0}</span>
                <span className="chip">Skills {deferredEduclawOverview?.source_summary.counts.skills ?? 0}</span>
                <span className="chip">Extensions {deferredEduclawOverview?.source_summary.counts.extensions ?? 0}</span>
              </div>
              <div className="card-grid compact">
                <article className="mini-card">
                  <h3>Allowed channels</h3>
                  <div className="chip-row">
                    {educlawAllowedChannels.map(channel => (
                      <span className="chip" key={channel}>{channel}</span>
                    ))}
                  </div>
                </article>
                <article className="mini-card">
                  <h3>Denied tools</h3>
                  <div className="chip-row">
                    {educlawDeniedTools.slice(0, 8).map(tool => (
                      <span className="chip" key={tool}>{tool}</span>
                    ))}
                  </div>
                </article>
              </div>
              <div className="preview-card embedded">
                <p className="mini-label">Imported from</p>
                <p>{deferredEduclawOverview?.source_summary.path || 'No local OpenClaw path detected.'}</p>
              </div>
            </div>

            <div className="subpanel">
              <div className="preview-topline">
                <div>
                  <span className="mini-label">Bootstrap</span>
                  <h3>Create EduClaw Control Plane</h3>
                </div>
                <span className="pill">{educlawDraft.local_mode}</span>
              </div>
              <form className="form-grid" onSubmit={bootstrapEduClaw}>
                <div className="two-up">
                  <label className="field">
                    <span>School</span>
                    <input value={educlawDraft.school_name} onChange={event => setEduclawDraft(current => ({ ...current, school_name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Teacher</span>
                    <input value={educlawDraft.teacher_name} onChange={event => setEduclawDraft(current => ({ ...current, teacher_name: event.target.value }))} />
                  </label>
                </div>
                <div className="two-up">
                  <label className="field">
                    <span>Classroom</span>
                    <input value={educlawDraft.classroom_title} onChange={event => setEduclawDraft(current => ({ ...current, classroom_title: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Subject</span>
                    <input value={educlawDraft.subject} onChange={event => setEduclawDraft(current => ({ ...current, subject: event.target.value }))} />
                  </label>
                </div>
                <div className="two-up">
                  <label className="field">
                    <span>Grade band</span>
                    <input value={educlawDraft.grade_band} onChange={event => setEduclawDraft(current => ({ ...current, grade_band: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Runtime mode</span>
                    <select value={educlawDraft.local_mode} onChange={event => setEduclawDraft(current => ({ ...current, local_mode: event.target.value as typeof defaultEduClawDraft.local_mode }))}>
                      <option value="no-llm">No-LLM</option>
                      <option value="local-llm">Local-LLM</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Description</span>
                  <textarea value={educlawDraft.description} onChange={event => setEduclawDraft(current => ({ ...current, description: event.target.value }))} />
                </label>
                <div className="two-up">
                  <label className="field">
                    <span>Default template</span>
                    <select value={educlawDraft.default_template_id} onChange={event => setEduclawDraft(current => ({ ...current, default_template_id: event.target.value }))}>
                      {deferredTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Assignment template</span>
                    <select value={educlawDraft.template_id} onChange={event => setEduclawDraft(current => ({ ...current, template_id: event.target.value }))}>
                      {deferredTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Assignment title</span>
                  <input value={educlawDraft.assignment_title} onChange={event => setEduclawDraft(current => ({ ...current, assignment_title: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Assignment summary</span>
                  <textarea value={educlawDraft.assignment_summary} onChange={event => setEduclawDraft(current => ({ ...current, assignment_summary: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Topic</span>
                  <input value={educlawDraft.topic} onChange={event => setEduclawDraft(current => ({ ...current, topic: event.target.value }))} />
                </label>
                <div className="two-up">
                  <label className="field">
                    <span>Goals</span>
                    <textarea value={educlawDraft.goalsText} onChange={event => setEduclawDraft(current => ({ ...current, goalsText: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Rubric</span>
                    <textarea value={educlawDraft.rubricText} onChange={event => setEduclawDraft(current => ({ ...current, rubricText: event.target.value }))} />
                  </label>
                </div>
                <div className="two-up">
                  <label className="field">
                    <span>Standards</span>
                    <textarea value={educlawDraft.standardsText} onChange={event => setEduclawDraft(current => ({ ...current, standardsText: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Due date</span>
                    <input value={educlawDraft.due_date} onChange={event => setEduclawDraft(current => ({ ...current, due_date: event.target.value }))} />
                  </label>
                </div>
                <button className="action-button full-width" disabled={isWorking || !deferredEduclawOverview?.source_summary.available}>
                  {isWorking ? 'Bootstrapping EduClaw...' : 'Bootstrap EduClaw'}
                </button>
              </form>
            </div>
          </div>

          {deferredEduclawBootstrapResult ? (
            <div className="preview-card">
              <div className="preview-topline">
                <div>
                  <span className="mini-label">Generated control plane</span>
                  <h3>{deferredEduclawBootstrapResult.classroom.title}</h3>
                </div>
                <span className="pill">{deferredEduclawBootstrapResult.assignment.title}</span>
              </div>
              <p>{deferredEduclawBootstrapResult.control_plane_path}</p>
              <p className="mini-label">Attestation: {deferredEduclawBootstrapResult.attestation_path}</p>
              <div className="chip-row">
                {((((deferredEduclawBootstrapResult.control_plane.gateway as Record<string, unknown> | undefined)?.allowed_channels) as string[] | undefined) ?? []).map(channel => (
                  <span className="chip" key={channel}>{channel}</span>
                ))}
              </div>
              <div className="chip-row">
                <span className="chip">Integrity {(educlawAttestation?.config_sha256 as string | undefined)?.slice(0, 12) ?? 'n/a'}</span>
                <span className="chip">Signature {String(educlawAttestation?.signature_algorithm ?? 'n/a')}</span>
                <span className="chip">Attestation {String(educlawAttestation?.attestation_id ?? 'n/a')}</span>
              </div>
            </div>
          ) : null}
        </Panel>

        <section className="studio-grid">
          <div className="column">
            <Panel title="Starter Wizard" subtitle="Create a typed local project manifest and save it as project.yaml.">
              <form className="form-grid" onSubmit={createProject}>
                <label className="field">
                  <span>Project title</span>
                  <input value={draft.title} onChange={event => updateDraftField('title', event.target.value)} />
                </label>

                <label className="field">
                  <span>Summary</span>
                  <textarea value={draft.summary} onChange={event => updateDraftField('summary', event.target.value)} />
                </label>

                <label className="field">
                  <span>Topic</span>
                  <input value={draft.topic} onChange={event => updateDraftField('topic', event.target.value)} />
                </label>

                <label className="field">
                  <span>Audience</span>
                  <input value={draft.audience} onChange={event => updateDraftField('audience', event.target.value)} />
                </label>

                <label className="field">
                  <span>Goals</span>
                  <textarea value={draft.goalsText} onChange={event => updateDraftField('goalsText', event.target.value)} />
                </label>

                <label className="field">
                  <span>Rubric</span>
                  <textarea value={draft.rubricText} onChange={event => updateDraftField('rubricText', event.target.value)} />
                </label>

                <div className="two-up">
                  <label className="field">
                    <span>Template</span>
                    <select value={draft.template_id} onChange={event => updateDraftField('template_id', event.target.value)}>
                      {deferredTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Runtime mode</span>
                    <select value={draft.local_mode} onChange={event => updateDraftField('local_mode', event.target.value as ProjectDraft['local_mode'])}>
                      <option value="no-llm">No-LLM</option>
                      <option value="local-llm">Local-LLM</option>
                    </select>
                  </label>
                </div>

                <button className="action-button full-width" disabled={isWorking || isBooting}>
                  {isWorking ? 'Creating project...' : 'Create Local Project'}
                </button>
              </form>

              {selectedTemplate ? (
                <div className="preview-card">
                  <div className="preview-topline">
                    <div>
                      <span className="mini-label">Selected template</span>
                      <h3>{selectedTemplate.label}</h3>
                    </div>
                    <span className="pill">{selectedTemplate.project_type.replaceAll('_', ' ')}</span>
                  </div>
                  <p>{selectedTemplate.description}</p>
                  <div className="chip-row">
                    {selectedTemplate.export_targets.map(target => (
                      <span className="chip" key={target}>{target}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel title="Template Registry" subtitle="Built-in project blueprints for local-first open-source creation.">
              <div className="card-grid">
                {deferredTemplates.map(template => (
                  <article className={`template-card ${draft.template_id === template.id ? 'selected' : ''}`} key={template.id}>
                    <div className="preview-topline">
                      <div>
                        <span className="mini-label">{template.category}</span>
                        <h3>{template.label}</h3>
                      </div>
                      {template.supports_simulation ? <span className="pill">simulation</span> : null}
                    </div>
                    <p>{template.description}</p>
                    <div className="chip-row">
                      {template.sections.slice(0, 3).map(section => (
                        <span className="chip" key={section.section_id}>{section.title}</span>
                      ))}
                    </div>
                    <button className="text-button dark-on-light" type="button" onClick={() => updateDraftField('template_id', template.id)}>
                      Use Template
                    </button>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Community Packs" subtitle="Sample projects and plugin packs included for open-source reuse.">
              <div className="stack-tight">
                <div>
                  <p className="mini-label">Sample projects</p>
                  <div className="card-grid compact">
                    {(deferredOverview?.sample_projects ?? []).map(sample => (
                      <article className="mini-card" key={sample.slug}>
                        <h3>{sample.title}</h3>
                        <p>{sample.summary}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mini-label">Plugin packs</p>
                  <div className="card-grid compact">
                    {(deferredOverview?.plugins ?? []).map(plugin => (
                      <article className="mini-card" key={plugin.id}>
                        <h3>{plugin.label}</h3>
                        <p>{plugin.description}</p>
                        <div className="chip-row">
                          {plugin.capabilities.map(capability => (
                            <span className="chip" key={capability}>{capability}</span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="column">
            <Panel title="Workspace" subtitle="Select a project, edit the manifest, upload evidence, and compile locally.">
              <div className="workspace-shell">
                <div className="workspace-sidebar">
                  <p className="mini-label">Projects</p>
                  <div className="project-list">
                    {deferredProjects.map(item => (
                      <button
                        className={`project-list-item ${selectedProjectSlug === item.slug ? 'active' : ''}`}
                        key={item.slug}
                        type="button"
                        onClick={() => setSelectedProjectSlug(item.slug)}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.template_label}</span>
                        <small>{formatTimestamp(item.updated_at)}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="workspace-main">
                  {deferredProject ? (
                    <div className="stack-tight">
                      <div className="preview-card">
                        <div className="preview-topline">
                          <div>
                            <span className="mini-label">Project manifest</span>
                            <h3>{deferredProject.title}</h3>
                          </div>
                          <span className="pill">{deferredProject.local_mode}</span>
                        </div>
                        <p>{deferredProject.summary || deferredProject.topic}</p>
                        <div className="chip-row">
                          <span className="chip">{deferredProject.template_label}</span>
                          <span className="chip">{deferredProject.project_type.replaceAll('_', ' ')}</span>
                          <span className="chip">{deferredProject.documents.length} documents</span>
                          <span className="chip">{deferredProject.exports.length} exports</span>
                        </div>
                      </div>

                      <div className="form-grid">
                        <label className="field">
                          <span>Title</span>
                          <input value={deferredProject.title} onChange={event => updateProjectField('title', event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Summary</span>
                          <textarea value={deferredProject.summary} onChange={event => updateProjectField('summary', event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Topic</span>
                          <input value={deferredProject.topic} onChange={event => updateProjectField('topic', event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Audience</span>
                          <input value={deferredProject.audience} onChange={event => updateProjectField('audience', event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Runtime mode</span>
                          <select
                            value={deferredProject.local_mode}
                            onChange={event => updateProjectField('local_mode', event.target.value as StudioProject['local_mode'])}
                          >
                            <option value="no-llm">No-LLM</option>
                            <option value="local-llm">Local-LLM</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Goals</span>
                          <textarea value={deferredProject.goals.join('\n')} onChange={event => updateProjectTextList('goals', event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Rubric</span>
                          <textarea value={deferredProject.rubric.join('\n')} onChange={event => updateProjectTextList('rubric', event.target.value)} />
                        </label>
                      </div>

                      <div className="action-row">
                        <button className="action-button" onClick={() => void saveProjectEdits()} disabled={isWorking}>
                          Save Manifest
                        </button>
                        <button className="action-button secondary" onClick={() => void compileProject()} disabled={isWorking}>
                          Run Workflow
                        </button>
                      </div>

                      <div className="two-up">
                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Document ingestion</span>
                              <h3>Upload Sources</h3>
                            </div>
                            <span className="pill">{deferredProject.documents.length}</span>
                          </div>
                          <input className="file-input" type="file" multiple onChange={uploadDocuments} />
                          <div className="card-grid compact">
                            {deferredProject.documents.map(document => (
                              <article className="mini-card" key={document.document_id}>
                                <h3>{document.title}</h3>
                                <p>{document.summary}</p>
                                <div className="chip-row">
                                  <span className="chip">{document.reading_level}</span>
                                  <span className="chip">{document.chunk_count} chunks</span>
                                  <span className="chip">{document.extraction_method}</span>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>

                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Workflow builder</span>
                              <h3>Stages</h3>
                            </div>
                            <span className="pill">{deferredProject.workflow.stages.filter(stage => stage.enabled).length} enabled</span>
                          </div>
                          <div className="workflow-stage-list">
                            {deferredProject.workflow.stages.map(stage => (
                              <label className="stage-toggle" key={stage.stage_id}>
                                <input
                                  type="checkbox"
                                  checked={stage.enabled}
                                  onChange={() => toggleWorkflowStage(stage.stage_id)}
                                />
                                <div>
                                  <strong>{stage.label}</strong>
                                  <p>{stage.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="two-up">
                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Portability</span>
                              <h3>Backups and Imports</h3>
                            </div>
                            <span className="pill">{deferredSystemStatus?.portability.import_supported ? 'enabled' : 'limited'}</span>
                          </div>
                          <label className="field">
                            <span>Imported project title override</span>
                            <input value={importTitle} onChange={event => setImportTitle(event.target.value)} placeholder="Optional imported title" />
                          </label>
                          <input className="file-input" type="file" accept=".zip" onChange={importProjectBundle} />
                          <div className="action-row">
                            {bundleExport ? (
                              <a
                                className="text-button dark-on-light"
                                href={api.downloadUrl(deferredProject.slug, bundleExport.export_type)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Download Project Backup
                              </a>
                            ) : null}
                            <button className="text-button dark-on-light" type="button" onClick={() => void cloneProject()}>
                              Duplicate Current Project
                            </button>
                          </div>
                        </div>

                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Local AI</span>
                              <h3>Runtime Health</h3>
                            </div>
                            <span className="pill">
                              {deferredSystemStatus?.local_ai.ollama_reachable ? 'Ollama reachable' : 'Fallback mode'}
                            </span>
                          </div>
                          <div className="chip-row">
                            <span className="chip">Configured {deferredSystemStatus?.local_ai.configured_model || 'none'}</span>
                            <span className="chip">
                              OCR {deferredSystemStatus?.tools.tesseract_available ? 'tesseract ready' : 'not detected'}
                            </span>
                            <span className="chip">
                              Warmup {(deferredSystemStatus?.startup.state as string | undefined) ?? 'pending'}
                            </span>
                          </div>
                          <div className="card-grid compact">
                            {(deferredSystemStatus?.local_ai.available_models ?? []).slice(0, 4).map(model => (
                              <article className="mini-card" key={model}>
                                <h3>{model}</h3>
                                <p>Available through the local Ollama-compatible runtime.</p>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      Create a project from the starter wizard or select an existing workspace to begin.
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel title="Evidence and Provenance" subtitle="Search uploaded chunks and inspect the compiled knowledge graph.">
              {deferredProject ? (
                <div className="stack-tight">
                  <div className="action-row">
                    <input
                      className="search-input"
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      placeholder="Search uploaded evidence"
                    />
                    <button className="action-button" onClick={() => void runSearch()} disabled={isWorking}>
                      Search Evidence
                    </button>
                  </div>

                  <div className="card-grid compact">
                    {deferredSearchResults.map(result => (
                      <article className="mini-card" key={result.chunk_id}>
                        <div className="preview-topline">
                          <div>
                            <span className="mini-label">{result.citation_label}</span>
                            <h3>{result.score.toFixed(1)}%</h3>
                          </div>
                          <span className="pill">{result.match_reason}</span>
                        </div>
                        <p>{result.excerpt}</p>
                      </article>
                    ))}
                  </div>

                  {deferredGraph ? (
                    <div className="preview-card">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Knowledge graph</span>
                          <h3>{deferredGraph.nodes.length} nodes</h3>
                        </div>
                        <span className="pill">{deferredGraph.edges.length} edges</span>
                      </div>
                      <ul className="narrative-list">
                        {deferredGraph.highlights.map(highlight => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="empty-state">Evidence search activates after a project is selected.</div>
              )}
            </Panel>

            <Panel title="Agent Runtime and Exports" subtitle="Artifact-producing agents, rubric review, simulation blueprint, and local bundles.">
              {deferredProject ? (
                <div className="stack-tight">
                  {compileArtifacts ? (
                    <>
                      <div className="card-grid">
                        {compileArtifacts.agents.map(agent => (
                          <article className="agent-card" key={agent.agent_name}>
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">{agent.role}</span>
                                <h3>{agent.display_name}</h3>
                              </div>
                              <span className={`priority-pill ${agent.priority}`}>{agent.priority}</span>
                            </div>
                            <p>{agent.summary}</p>
                            <div className="chip-row">
                              <span className="chip">{agent.confidence.toFixed(1)}%</span>
                              {agent.signals.slice(0, 2).map(signal => (
                                <span className="chip" key={signal}>{signal}</span>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="two-up">
                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Written sections</span>
                              <h3>Draft Artifacts</h3>
                            </div>
                          </div>
                          <div className="card-grid compact">
                            {(((compileArtifacts.artifacts.written_sections as Record<string, unknown> | undefined)?.sections) as Array<Record<string, unknown>> | undefined ?? []).map(section => (
                              <article className="mini-card" key={String(section.section_id)}>
                                <h3>{String(section.title)}</h3>
                                <p>{String(section.body)}</p>
                              </article>
                            ))}
                          </div>
                        </div>

                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Teacher review</span>
                              <h3>Rubric Signals</h3>
                            </div>
                          </div>
                          <div className="preview-card embedded">
                            <p>
                              Overall score:{' '}
                              {String((compileArtifacts.artifacts.teacher_review as Record<string, unknown> | undefined)?.overall_score ?? 'n/a')}
                            </p>
                            <ul className="narrative-list">
                              {((((compileArtifacts.artifacts.teacher_review as Record<string, unknown> | undefined)?.teacher_notes) as string[] | undefined) ?? []).map(note => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="two-up">
                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Simulation blueprint</span>
                              <h3>Branching Engine</h3>
                            </div>
                          </div>
                          <div className="preview-card embedded">
                            <p>
                              Enabled:{' '}
                              {String((compileArtifacts.artifacts.simulation_blueprint as Record<string, unknown> | undefined)?.enabled ?? false)}
                            </p>
                            <p>
                              Nodes:{' '}
                              {String((((compileArtifacts.artifacts.simulation_blueprint as Record<string, unknown> | undefined)?.nodes) as unknown[] | undefined)?.length ?? 0)}
                            </p>
                          </div>
                        </div>

                        <div className="subpanel">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Exports</span>
                              <h3>Local Bundles</h3>
                            </div>
                          </div>
                          <div className="card-grid compact">
                            {exports.map(exportEntry => (
                              <article className="mini-card" key={exportEntry.export_type}>
                                <h3>{exportEntry.export_type.replaceAll('_', ' ')}</h3>
                                <p>{exportEntry.path}</p>
                                <a className="text-button dark-on-light" href={api.downloadUrl(deferredProject.slug, exportEntry.export_type)} target="_blank" rel="noreferrer">
                                  Download
                                </a>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      Run the project workflow to generate research briefs, citations, drafts, design tokens, review, and exports.
                    </div>
                  )}

                  <div className="two-up">
                    <div className="subpanel">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Classroom review</span>
                          <h3>Rubric and Standards</h3>
                        </div>
                        <span className="pill">{standardsAlignment.length} standards</span>
                      </div>
                      <div className="chip-row">
                        {standardsAlignment.map(standard => (
                          <span className="chip" key={standard.standard_id}>
                            {standard.label}
                          </span>
                        ))}
                      </div>
                      <div className="preview-card embedded">
                        <p>
                          Rubric report:{' '}
                          {rubricExport ? (
                            <a
                              className="text-button dark-on-light"
                              href={api.downloadUrl(deferredProject.slug, rubricExport.export_type)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download latest report
                            </a>
                          ) : (
                            'Run workflow to generate a rubric export.'
                          )}
                        </p>
                        <ul className="narrative-list">
                          {standardsAlignment.map(standard => (
                            <li key={standard.standard_id}>{standard.reason}</li>
                          ))}
                        </ul>
                      </div>

                      <form className="form-grid" onSubmit={submitTeacherComment}>
                        <label className="field">
                          <span>Reviewer</span>
                          <input
                            value={teacherComment.author}
                            onChange={event => setTeacherComment(current => ({ ...current, author: event.target.value }))}
                          />
                        </label>
                        <label className="field">
                          <span>Criterion</span>
                          <input
                            value={teacherComment.criterion}
                            onChange={event => setTeacherComment(current => ({ ...current, criterion: event.target.value }))}
                            placeholder="Optional rubric criterion"
                          />
                        </label>
                        <label className="field">
                          <span>Comment</span>
                          <textarea
                            value={teacherComment.body}
                            onChange={event => setTeacherComment(current => ({ ...current, body: event.target.value }))}
                            placeholder="Add classroom feedback and revision direction"
                          />
                        </label>
                        <button className="action-button" disabled={isWorking || !teacherComment.body.trim()}>
                          Save Teacher Comment
                        </button>
                      </form>

                      <div className="card-grid compact">
                        {teacherComments.slice(0, 4).map(comment => (
                          <article className="mini-card" key={comment.comment_id}>
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">{comment.criterion || 'General review'}</span>
                                <h3>{comment.author}</h3>
                              </div>
                              <span className="pill">{formatTimestamp(comment.created_at)}</span>
                            </div>
                            <p>{comment.body}</p>
                          </article>
                        ))}
                        {teacherComments.length === 0 ? <div className="empty-state">No teacher comments yet.</div> : null}
                      </div>
                    </div>

                    <div className="subpanel">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Revision history</span>
                          <h3>Project Timeline</h3>
                        </div>
                        <span className="pill">{revisionHistory.length} entries</span>
                      </div>
                      {revisionHistory.length > 0 ? (
                        <ul className="narrative-list">
                          {revisionHistory.slice(0, 8).map(revision => (
                            <li key={revision.revision_id}>
                              <strong>{revision.action}</strong> by {revision.actor} on {formatTimestamp(revision.created_at)}
                              <br />
                              {revision.summary}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-state">Revision history will appear as the project evolves.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  Select a project to inspect agent outputs, teacher review, revision history, and export bundles.
                </div>
              )}
            </Panel>
          </div>
        </section>

        <section className="studio-grid">
          <div className="column">
            <Panel title="Teacher OS" subtitle="Create bounded classrooms, seed approved evidence, and launch assignment-driven student work.">
              <div className="workspace-shell">
                <div className="workspace-sidebar">
                  <p className="mini-label">Classrooms</p>
                  <div className="project-list">
                    {deferredEducationClassrooms.map(item => (
                      <button
                        className={`project-list-item ${selectedClassroomId === item.classroom_id ? 'active' : ''}`}
                        key={item.classroom_id}
                        type="button"
                        onClick={() => setSelectedClassroomId(item.classroom_id)}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.subject}</span>
                        <small>{item.student_count} students</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="workspace-main">
                  <div className="stack-tight">
                    <div className="preview-card">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Education OS</span>
                          <h3>{deferredEducationOverview?.product_name ?? 'Education OS'}</h3>
                        </div>
                        <span className="pill">{deferredEducationSafety?.mode?.replaceAll('_', ' ') ?? 'bounded'}</span>
                      </div>
                      <p>{deferredEducationOverview?.positioning ?? 'Open-source local-first orchestration for teachers and students.'}</p>
                      <div className="chip-row">
                        {deferredEducationOverview?.role_models.map(model => (
                          <span className="chip" key={model.role}>{model.label}</span>
                        ))}
                      </div>
                    </div>

                    <form className="form-grid" onSubmit={createClassroom}>
                      <label className="field">
                        <span>Classroom title</span>
                        <input value={classroomDraft.title} onChange={event => setClassroomDraft(current => ({ ...current, title: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Subject</span>
                        <input value={classroomDraft.subject} onChange={event => setClassroomDraft(current => ({ ...current, subject: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Grade band</span>
                        <input value={classroomDraft.grade_band} onChange={event => setClassroomDraft(current => ({ ...current, grade_band: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Teacher</span>
                        <input value={classroomDraft.teacher_name} onChange={event => setClassroomDraft(current => ({ ...current, teacher_name: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <textarea value={classroomDraft.description} onChange={event => setClassroomDraft(current => ({ ...current, description: event.target.value }))} />
                      </label>
                      <div className="two-up">
                        <label className="field">
                          <span>Default template</span>
                          <select value={classroomDraft.default_template_id} onChange={event => setClassroomDraft(current => ({ ...current, default_template_id: event.target.value }))}>
                            {deferredTemplates.map(template => (
                              <option key={template.id} value={template.id}>
                                {template.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Standards focus</span>
                          <textarea value={classroomDraft.standardsText} onChange={event => setClassroomDraft(current => ({ ...current, standardsText: event.target.value }))} />
                        </label>
                      </div>
                      <button className="action-button full-width" disabled={isWorking}>
                        {isWorking ? 'Saving classroom...' : 'Create Bounded Classroom'}
                      </button>
                    </form>

                    {selectedClassroom ? (
                      <>
                        <div className="preview-card embedded">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">Selected classroom</span>
                              <h3>{selectedClassroom.title}</h3>
                            </div>
                            <span className="pill">{selectedClassroom.grade_band}</span>
                          </div>
                          <p>{selectedClassroom.description}</p>
                          <div className="chip-row">
                            <span className="chip">{selectedClassroom.student_count} students</span>
                            <span className="chip">{selectedClassroom.assignment_count} assignments</span>
                            <span className="chip">{selectedClassroom.evidence_count} materials</span>
                            <span className="chip">{selectedClassroom.project_count} launched projects</span>
                          </div>
                          <div className="chip-row">
                            <span className="chip">Protected {selectedClassroom.security_posture?.protected ? 'yes' : 'no'}</span>
                            <span className="chip">Audit chain {selectedClassroom.security_posture?.audit_chain_valid ? 'valid' : 'check required'}</span>
                            <span className="chip">Approval chain {selectedClassroom.security_posture?.approval_chain_valid ? 'valid' : 'check required'}</span>
                            <span className="chip">Vault {selectedClassroomKeys ? 'local keys present' : 'missing keys'}</span>
                          </div>
                        </div>

                        <div className="two-up">
                          <div className="subpanel">
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">Teacher roster</span>
                                <h3>Enroll Student</h3>
                              </div>
                            </div>
                            <form className="form-grid" onSubmit={enrollStudent}>
                              <label className="field">
                                <span>Name</span>
                                <input value={studentDraft.name} onChange={event => setStudentDraft(current => ({ ...current, name: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Grade level</span>
                                <input value={studentDraft.grade_level} onChange={event => setStudentDraft(current => ({ ...current, grade_level: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Learning goals</span>
                                <textarea value={studentDraft.learningGoalsText} onChange={event => setStudentDraft(current => ({ ...current, learningGoalsText: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Notes</span>
                                <textarea value={studentDraft.notes} onChange={event => setStudentDraft(current => ({ ...current, notes: event.target.value }))} />
                              </label>
                              <button className="action-button" disabled={isWorking}>Enroll Student</button>
                            </form>
                          </div>

                          <div className="subpanel">
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">Assignment builder</span>
                                <h3>Create Assignment</h3>
                              </div>
                            </div>
                            <form className="form-grid" onSubmit={createAssignment}>
                              <label className="field">
                                <span>Title</span>
                                <input value={assignmentDraft.title} onChange={event => setAssignmentDraft(current => ({ ...current, title: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Summary</span>
                                <textarea value={assignmentDraft.summary} onChange={event => setAssignmentDraft(current => ({ ...current, summary: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Topic</span>
                                <input value={assignmentDraft.topic} onChange={event => setAssignmentDraft(current => ({ ...current, topic: event.target.value }))} />
                              </label>
                              <div className="two-up">
                                <label className="field">
                                  <span>Template</span>
                                  <select value={assignmentDraft.template_id} onChange={event => setAssignmentDraft(current => ({ ...current, template_id: event.target.value }))}>
                                    {deferredTemplates.map(template => (
                                      <option key={template.id} value={template.id}>
                                        {template.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field">
                                  <span>Runtime mode</span>
                                  <select
                                    value={assignmentDraft.local_mode}
                                    onChange={event => setAssignmentDraft(current => ({ ...current, local_mode: event.target.value as typeof defaultAssignmentDraft.local_mode }))}
                                  >
                                    <option value="no-llm">No-LLM</option>
                                    <option value="local-llm">Local-LLM</option>
                                  </select>
                                </label>
                              </div>
                              <label className="field">
                                <span>Goals</span>
                                <textarea value={assignmentDraft.goalsText} onChange={event => setAssignmentDraft(current => ({ ...current, goalsText: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Rubric</span>
                                <textarea value={assignmentDraft.rubricText} onChange={event => setAssignmentDraft(current => ({ ...current, rubricText: event.target.value }))} />
                              </label>
                              <div className="two-up">
                                <label className="field">
                                  <span>Standards</span>
                                  <textarea value={assignmentDraft.standardsText} onChange={event => setAssignmentDraft(current => ({ ...current, standardsText: event.target.value }))} />
                                </label>
                                <label className="field">
                                  <span>Due date</span>
                                  <input value={assignmentDraft.due_date} onChange={event => setAssignmentDraft(current => ({ ...current, due_date: event.target.value }))} />
                                </label>
                              </div>
                              <button className="action-button" disabled={isWorking}>Create Assignment</button>
                            </form>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">Create the first classroom to activate Teacher OS.</div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="column">
            <Panel title="Student OS and Safety Layer" subtitle="Launch student projects from approved materials, run scoped agents, and inspect approvals and audit trails.">
              {selectedClassroom ? (
                <div className="stack-tight">
                  <div className="two-up">
                    <div className="subpanel">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Classroom controls</span>
                          <h3>Shared Classroom Layer</h3>
                        </div>
                        <span className="pill">{selectedClassroom.safety_mode.replaceAll('_', ' ')}</span>
                      </div>
                      <div className="two-up">
                        <label className="field">
                          <span>Assignment</span>
                          <select value={selectedAssignmentId} onChange={event => setSelectedAssignmentId(event.target.value)}>
                            {selectedClassroom.assignments.map(item => (
                              <option key={item.assignment_id} value={item.assignment_id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Student</span>
                          <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)}>
                            {selectedClassroom.students.map(item => (
                              <option key={item.student_id} value={item.student_id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="chip-row">
                        <span className="chip">{selectedAssignment?.template_label ?? 'No assignment selected'}</span>
                        <span className="chip">{selectedStudent?.name ?? 'No student selected'}</span>
                        <span className="chip">{selectedClassroom.evidence_library.length} approved materials</span>
                        <span className="chip">Max upload {selectedClassroom.security_posture?.max_material_bytes ?? 0} bytes</span>
                      </div>
                      <div className="action-row">
                        <button className="action-button" type="button" onClick={() => void launchStudentProject()} disabled={isWorking || !selectedAssignment || !selectedStudent}>
                          Launch Student Project
                        </button>
                      </div>
                      <input className="file-input" type="file" multiple onChange={uploadClassroomMaterials} />
                      <div className="card-grid compact">
                        {selectedClassroom.evidence_library.slice(0, 6).map(material => (
                          <article className="mini-card" key={material.material_id}>
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">{material.scope}</span>
                                <h3>{material.title}</h3>
                              </div>
                              <span className="pill">{material.extraction_method}</span>
                            </div>
                            <p>{material.summary}</p>
                          </article>
                        ))}
                        {selectedClassroom.evidence_library.length === 0 ? <div className="empty-state">Upload approved classroom materials to seed student work.</div> : null}
                      </div>
                    </div>

                    <div className="subpanel">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Agent runtime</span>
                          <h3>Bounded Agent Studio</h3>
                        </div>
                        <span className="pill">{educationAgentDraft.role}</span>
                      </div>
                      <div className="two-up">
                        <label className="field">
                          <span>Role</span>
                          <select value={educationAgentDraft.role} onChange={event => updateEducationAgentRole(event.target.value as 'teacher' | 'student' | 'shared')}>
                            <option value="teacher">Teacher</option>
                            <option value="student">Student</option>
                            <option value="shared">Shared</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Agent</span>
                          <select
                            value={educationAgentDraft.agent_name}
                            onChange={event => setEducationAgentDraft(current => ({ ...current, agent_name: event.target.value }))}
                          >
                            {filteredEducationAgents.map(agent => (
                              <option key={agent.name} value={agent.name}>
                                {agent.display_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="field">
                        <span>Prompt</span>
                        <textarea
                          value={educationAgentDraft.prompt}
                          onChange={event => setEducationAgentDraft(current => ({ ...current, prompt: event.target.value }))}
                          placeholder="Describe the classroom-safe task for the agent."
                        />
                      </label>
                      <button className="action-button full-width" type="button" onClick={() => void runEducationAgent()} disabled={isWorking}>
                        Run Bounded Agent
                      </button>

                      {educationAgentResult ? (
                        <div className="preview-card embedded">
                          <div className="preview-topline">
                            <div>
                              <span className="mini-label">{educationAgentResult.role}</span>
                              <h3>{educationAgentResult.display_name}</h3>
                            </div>
                            <span className={`priority-pill ${educationAgentResult.requires_approval ? 'high' : 'low'}`}>
                              {educationAgentResult.requires_approval ? 'approval required' : 'completed'}
                            </span>
                          </div>
                          <p>{educationAgentResult.summary}</p>
                          <div className="chip-row">
                            {educationAgentResult.allowed_actions.slice(0, 4).map(action => (
                              <span className="chip" key={action}>{action}</span>
                            ))}
                            <span className="chip">Risk {educationAgentResult.risk_assessment.band}</span>
                            <span className="chip">Score {educationAgentResult.risk_assessment.score}</span>
                          </div>
                          <div className="chip-row">
                            {educationAgentResult.risk_assessment.signals.map(signal => (
                              <span className="chip" key={signal}>{signal}</span>
                            ))}
                          </div>
                          <ul className="narrative-list">
                            {Object.entries(educationAgentResult.artifacts).map(([key, value]) => (
                              <li key={key}>
                                <strong>{key}</strong>: {typeof value === 'string' ? value : JSON.stringify(value).slice(0, 220)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="two-up">
                    <div className="subpanel">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Approval gates</span>
                          <h3>Safety Queue</h3>
                        </div>
                        <span className="pill">{deferredEducationApprovals.filter(item => item.status === 'pending').length} pending</span>
                      </div>
                      <div className="form-grid">
                        <label className="field">
                          <span>Reviewer</span>
                          <input value={approvalReview.reviewer} onChange={event => setApprovalReview(current => ({ ...current, reviewer: event.target.value }))} />
                        </label>
                        <label className="field">
                          <span>Resolution note</span>
                          <textarea value={approvalReview.note} onChange={event => setApprovalReview(current => ({ ...current, note: event.target.value }))} />
                        </label>
                      </div>
                      <div className="card-grid compact">
                        {deferredEducationApprovals.slice(0, 6).map(approval => (
                          <article className="mini-card" key={approval.approval_id}>
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">{approval.role}</span>
                                <h3>{approval.agent_name}</h3>
                              </div>
                              <span className="pill">{approval.status}</span>
                            </div>
                            <p>{approval.rationale}</p>
                            <div className="chip-row">
                              {approval.requested_actions.map(action => (
                                <span className="chip" key={action}>{action}</span>
                              ))}
                              {approval.risk_assessment ? <span className="chip">Risk {approval.risk_assessment.band}</span> : null}
                              {approval.entry_hash ? <span className="chip">Hash {approval.entry_hash.slice(0, 10)}</span> : null}
                            </div>
                            {approval.status === 'pending' ? (
                              <div className="action-row">
                                <button className="text-button dark-on-light" type="button" onClick={() => void resolveApproval(approval.approval_id, 'approved')}>
                                  Approve
                                </button>
                                <button className="text-button dark-on-light" type="button" onClick={() => void resolveApproval(approval.approval_id, 'rejected')}>
                                  Reject
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))}
                        {deferredEducationApprovals.length === 0 ? <div className="empty-state">No approval requests yet.</div> : null}
                      </div>
                    </div>

                    <div className="subpanel">
                      <div className="preview-topline">
                        <div>
                          <span className="mini-label">Audit and policy</span>
                          <h3>Safety Console</h3>
                        </div>
                        <span className="pill">{deferredEducationSafety?.policy_name ?? 'policy'}</span>
                      </div>
                      <div className="chip-row">
                        {(deferredEducationSafety?.blocked_capabilities ?? []).map(capability => (
                          <span className="chip" key={capability}>{capability}</span>
                        ))}
                        <span className="chip">Audit chain {deferredEducationSafety?.audit_chain_valid ? 'valid' : 'check required'}</span>
                        <span className="chip">Approval chain {deferredEducationSafety?.approval_chain_valid ? 'valid' : 'check required'}</span>
                      </div>
                      <ul className="narrative-list">
                        {(deferredEducationSafety?.approval_required_for ?? []).map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <p className="mini-label">
                        Material policy: max {String((deferredEducationSafety?.material_policy?.max_material_bytes as number | undefined) ?? 0)} bytes, types{' '}
                        {((deferredEducationSafety?.material_policy?.allowed_content_types as string[] | undefined) ?? []).join(', ') || 'n/a'}
                      </p>
                      <div className="card-grid compact">
                        {deferredEducationAudit.slice(0, 6).map(entry => (
                          <article className="mini-card" key={entry.audit_id}>
                            <div className="preview-topline">
                              <div>
                                <span className="mini-label">{entry.actor_role}</span>
                                <h3>{entry.action}</h3>
                              </div>
                              <span className="pill">{entry.status}</span>
                            </div>
                            <p>{entry.summary}</p>
                            <div className="chip-row">
                              {entry.risk_assessment ? <span className="chip">Risk {entry.risk_assessment.band}</span> : null}
                              {entry.entry_hash ? <span className="chip">Hash {entry.entry_hash.slice(0, 10)}</span> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  Teacher OS activates after the first classroom is created.
                </div>
              )}
            </Panel>
          </div>
        </section>

        <section className="lower-grid">
          <Panel title="Open Source Guidance" subtitle="What this repo now ships for reusable local-first project building.">
            <div className="card-grid compact">
              {agentCatalog.map(agent => (
                <article className="mini-card" key={agent.name}>
                  <h3>{agent.display_name}</h3>
                  <p>{agent.description}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Admin Ops" subtitle="Optional monitoring for local orchestration and benchmark health.">
            {adminReady ? (
              <div className="stack-tight">
                <div className="preview-card embedded">
                  <div className="preview-topline">
                    <div>
                      <span className="mini-label">Admin session</span>
                      <h3>{deferredAdminStatus?.current_user.username ?? 'admin'}</h3>
                    </div>
                    <button className="text-button dark-on-light" type="button" onClick={logout}>
                      Log out
                    </button>
                  </div>
                  <p>{maskDatabaseUrl(deferredAdminStatus?.database_url ?? '')}</p>
                  <div className="chip-row">
                    <span className="chip">Scheduler {deferredHealth?.scheduler.enabled ? 'enabled' : 'disabled'}</span>
                    <span className="chip">ETL {formatSeconds(deferredHealth?.scheduler.etl_interval_seconds)}</span>
                    <span className="chip">Retrain {formatSeconds(deferredHealth?.scheduler.retrain_interval_seconds)}</span>
                    <span className="chip">Benchmark {formatSeconds(deferredHealth?.scheduler.benchmark_interval_seconds)}</span>
                  </div>
                </div>

                {deferredBenchmark ? (
                  <div className="preview-card embedded">
                    <div className="preview-topline">
                      <div>
                        <span className="mini-label">Latest benchmark</span>
                        <h3>{deferredBenchmark.overall_score}%</h3>
                      </div>
                      <span className="pill">{formatTimestamp(deferredBenchmark.generated_at)}</span>
                    </div>
                    <ul className="narrative-list">
                      {deferredBenchmark.recommendations.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="empty-state">No benchmark report has been generated yet.</div>
                )}
              </div>
            ) : (
              <form className="form-grid" onSubmit={handleLogin}>
                <label className="field">
                  <span>Username</span>
                  <input value={credentials.username} onChange={event => setCredentials(current => ({ ...current, username: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={event => setCredentials(current => ({ ...current, password: event.target.value }))}
                  />
                </label>
                <button className="action-button full-width" disabled={isWorking}>
                  {isWorking ? 'Signing in...' : 'Log in for admin monitoring'}
                </button>
              </form>
            )}
          </Panel>
        </section>
      </main>

      {(isBooting || isPending) ? <div className="loading-ribbon">Syncing local studio...</div> : null}
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
}: {
  label: string
  value: number | string | undefined
}) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value ?? '--'}</strong>
    </article>
  )
}

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
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
  if (!databaseUrl) {
    return 'pending'
  }
  if (databaseUrl.startsWith('sqlite:///')) {
    const segments = databaseUrl.split('/')
    return `sqlite:///.../${segments.slice(-2).join('/')}`
  }
  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:••••@')
}

export default App
