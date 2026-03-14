import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 8123
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`
const MAX_BACKEND_RESTARTS = 3
const MAX_RECENT_PROJECTS = 8
const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000
const { autoUpdater } = electronUpdater

let mainWindow = null
let splashWindow = null
let backendProcess = null
let isShuttingDown = false
let workspaceRoot = ''
let backendRestartAttempts = 0
let queuedOpenTargets = []
let processingOpenTargets = false
let updateCheckTimer = null

let desktopConfig = sanitizeConfig({})
let pendingProjectSlug = ''
let recoveryState = {
  unclean_exit: false,
  imported_path: '',
  imported_project_slug: '',
}
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: '',
  downloadedVersion: '',
  lastCheckedAt: '',
  message: 'Ready to check for updates.',
  error: '',
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

function configDir() {
  return path.join(app.getPath('appData'), 'Civic Project Studio')
}

function configPath() {
  return path.join(configDir(), 'desktop-config.json')
}

function sanitizeRecentProjects(value) {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item) => item && typeof item.slug === 'string' && typeof item.title === 'string')
    .map((item) => ({
      slug: item.slug,
      title: item.title,
      manifestPath: typeof item.manifestPath === 'string' ? item.manifestPath : '',
      bundlePath: typeof item.bundlePath === 'string' ? item.bundlePath : '',
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
    }))
    .slice(0, MAX_RECENT_PROJECTS)
}

function sanitizeConfig(payload) {
  const bounds = payload.windowBounds && typeof payload.windowBounds === 'object'
    ? payload.windowBounds
    : {}
  return {
    workspaceRoot: typeof payload.workspaceRoot === 'string' ? payload.workspaceRoot : '',
    recentProjects: sanitizeRecentProjects(payload.recentProjects),
    lastProjectSlug: typeof payload.lastProjectSlug === 'string' ? payload.lastProjectSlug : '',
    windowBounds: {
      width: Number.isFinite(bounds.width) ? bounds.width : 1440,
      height: Number.isFinite(bounds.height) ? bounds.height : 960,
      x: Number.isFinite(bounds.x) ? bounds.x : undefined,
      y: Number.isFinite(bounds.y) ? bounds.y : undefined,
    },
    cleanExit: payload.cleanExit !== false,
    launchAtLogin: payload.launchAtLogin === true,
    hasSeenMovePrompt: payload.hasSeenMovePrompt === true,
  }
}

function loadConfig() {
  try {
    desktopConfig = sanitizeConfig(JSON.parse(readFileSync(configPath(), 'utf-8')))
  } catch {
    desktopConfig = sanitizeConfig({})
  }
  return desktopConfig
}

function persistConfig() {
  mkdirSync(configDir(), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(desktopConfig, null, 2), 'utf-8')
}

function saveConfig(partial) {
  desktopConfig = sanitizeConfig({ ...desktopConfig, ...partial })
  persistConfig()
}

function defaultWorkspaceRoot() {
  return path.join(app.getPath('documents'), 'CivicProjectStudioWorkspace')
}

function ensureWorkspace(rootPath) {
  mkdirSync(rootPath, { recursive: true })
  mkdirSync(path.join(rootPath, 'backend-data'), { recursive: true })
  mkdirSync(path.join(rootPath, 'studio_workspace'), { recursive: true })
  return rootPath
}

function workspaceDataPaths(rootPath = workspaceRoot) {
  return {
    dbPath: path.join(rootPath, 'backend-data', 'civic_project_studio.sqlite3'),
    modelCacheDir: path.join(rootPath, 'backend-data', 'model-cache'),
    studioRoot: path.join(rootPath, 'studio_workspace'),
  }
}

function bundledResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments)
  }
  return path.resolve(__dirname, '..', ...segments)
}

function bootstrapResourcePath(...segments) {
  if (app.isPackaged) {
    return bundledResourcePath('desktop-bootstrap', ...segments)
  }
  return path.resolve(__dirname, 'bootstrap', ...segments)
}

function primeWorkspace(rootPath) {
  const paths = workspaceDataPaths(rootPath)
  const bootstrapDbPath = bootstrapResourcePath('civic_project_studio.sqlite3')
  const bootstrapModelCache = bootstrapResourcePath('model-cache')
  const needsBootstrap = !existsSync(paths.dbPath)

  if (needsBootstrap && existsSync(bootstrapDbPath)) {
    cpSync(bootstrapDbPath, paths.dbPath)
  }
  if (needsBootstrap && existsSync(bootstrapModelCache)) {
    cpSync(bootstrapModelCache, paths.modelCacheDir, { recursive: true })
  }

  return rootPath
}

function frontendDistPath() {
  if (app.isPackaged) {
    return bundledResourcePath('frontend_dist')
  }
  return bundledResourcePath('frontend', 'dist')
}

function backendExecutableName() {
  return process.platform === 'win32' ? 'civic-project-studio-backend.exe' : 'civic-project-studio-backend'
}

function packagedBackendExecutablePath() {
  const executableName = backendExecutableName()
  const nestedExecutablePath = bundledResourcePath('backend-dist', 'civic-project-studio-backend', executableName)
  if (existsSync(nestedExecutablePath)) {
    return nestedExecutablePath
  }
  return bundledResourcePath('backend-dist', executableName)
}

function backendEnvironment() {
  const paths = workspaceDataPaths()
  const packagedAppPath = app.isPackaged
    ? path.resolve(process.execPath, '..', '..', '..')
    : path.resolve(__dirname)
  return {
    ...process.env,
    CIVIC_STUDIO_HOST: BACKEND_HOST,
    CIVIC_STUDIO_PORT: String(BACKEND_PORT),
    MLK_DB_PATH: paths.dbPath,
    MLK_STUDIO_ROOT: paths.studioRoot,
    MLK_STUDIO_TEMPLATE_DIR: bundledResourcePath('studio', 'templates'),
    MLK_COMMUNITY_ROOT: bundledResourcePath('community'),
    MLK_LEGACY_HTML_PATH: bundledResourcePath('Legacy_of_Justice.html'),
    MLK_FRONTEND_DIST_DIR: frontendDistPath(),
    MLK_MODEL_CACHE_DIR: paths.modelCacheDir,
    MLK_DESKTOP_VERSION: app.getVersion(),
    MLK_RELEASE_NOTES_PATH: bundledResourcePath('RELEASE_NOTES.md'),
    MLK_PACKAGED_APP_PATH: packagedAppPath,
    MLK_EAGER_MODEL_TRAINING: 'false',
    MLK_WORKFLOW_SCHEDULER_ENABLED: 'true',
  }
}

function splashUrl(message = 'Preparing your local-first workspace, model cache, and offline project engine...') {
  const document = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Civic Project Studio</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at top left, rgba(205, 126, 49, 0.18), transparent 30%),
            radial-gradient(circle at top right, rgba(31, 78, 112, 0.18), transparent 32%),
            linear-gradient(180deg, #f4ecde 0%, #efe6d6 40%, #e6dcc9 100%);
          color: #171310;
          font-family: "Iowan Old Style", "Baskerville", Georgia, serif;
        }
        main {
          width: min(560px, calc(100vw - 2rem));
          padding: 2rem;
          border-radius: 28px;
          background: rgba(255, 252, 246, 0.92);
          border: 1px solid rgba(35, 82, 122, 0.08);
          box-shadow: 0 20px 64px rgba(58, 41, 22, 0.14);
        }
        p {
          margin: 0;
          color: #6d5947;
          line-height: 1.5;
          font-family: Georgia, serif;
        }
        .eyebrow {
          margin-bottom: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 0.75rem;
          color: #7d5d3f;
        }
        h1 {
          margin: 0 0 0.85rem;
          color: #1e3547;
          font-size: clamp(2rem, 4vw, 3.4rem);
          line-height: 0.95;
        }
        .bar {
          margin-top: 1.2rem;
          height: 12px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(35, 82, 122, 0.08);
        }
        .bar::after {
          content: "";
          display: block;
          width: 42%;
          height: 100%;
          background: linear-gradient(90deg, #cf7f2e, #23527a);
          animation: drift 1.6s ease-in-out infinite alternate;
        }
        @keyframes drift {
          from { transform: translateX(-10%); }
          to { transform: translateX(140%); }
        }
      </style>
    </head>
    <body>
      <main>
        <p class="eyebrow">EduClaw Desktop</p>
        <h1>Opening workspace</h1>
        <p>${message}</p>
        <div class="bar"></div>
      </main>
    </body>
  </html>`
  return `data:text/html;charset=UTF-8,${encodeURIComponent(document)}`
}

function createSplashWindow(message) {
  if (splashWindow) {
    void splashWindow.loadURL(splashUrl(message))
    return
  }

  splashWindow = new BrowserWindow({
    width: 620,
    height: 420,
    resizable: false,
    movable: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    roundedCorners: true,
    show: true,
    backgroundColor: '#efe6d6',
    alwaysOnTop: true,
  })
  splashWindow.removeMenu()
  splashWindow.on('closed', () => {
    splashWindow = null
  })
  void splashWindow.loadURL(splashUrl(message))
}

function updateSplash(message) {
  createSplashWindow(message)
}

function closeSplashWindow() {
  if (splashWindow) {
    splashWindow.close()
    splashWindow = null
  }
}

function desktopUrl() {
  return `${BACKEND_URL}/desktop/`
}

function timestamp() {
  return new Date().toISOString()
}

function canInstallToApplications() {
  return Boolean(
    process.platform === 'darwin'
      && app.isPackaged
      && typeof app.isInApplicationsFolder === 'function'
      && !app.isInApplicationsFolder(),
  )
}

function updateDesktopState(partial) {
  updateState = { ...updateState, ...partial }
  broadcastDesktopState()
}

function hasUpdateConfiguration() {
  return app.isPackaged && existsSync(path.join(process.resourcesPath, 'app-update.yml'))
}

function getDesktopContext() {
  const loginSettings = app.isReady() && typeof app.getLoginItemSettings === 'function'
    ? app.getLoginItemSettings()
    : { openAtLogin: desktopConfig.launchAtLogin }

  return {
    isDesktop: true,
    backendUrl: BACKEND_URL,
    workspaceRoot,
    lastProjectSlug: desktopConfig.lastProjectSlug,
    pendingProjectSlug,
    recentProjects: desktopConfig.recentProjects,
    recovery: recoveryState,
    updater: updateState,
    preferences: {
      launchAtLogin: Boolean(loginSettings.openAtLogin),
    },
    canInstallToApplications: canInstallToApplications(),
    installTargetPath: '/Applications',
  }
}

function broadcastDesktopState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }
  mainWindow.webContents.send('desktop:state-changed', getDesktopContext())
}

function focusMainWindow() {
  if (!mainWindow) {
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function projectPathsForSlug(slug) {
  const projectDir = path.join(workspaceDataPaths().studioRoot, 'projects', slug)
  const manifestPath = path.join(projectDir, 'project.yaml')
  const exportDir = path.join(projectDir, 'exports')
  let bundlePath = ''
  if (existsSync(exportDir)) {
    const bundleCandidate = readdirSync(exportDir).find((entry) => entry.endsWith('.cpsbundle') || entry.endsWith('-bundle.zip'))
    if (bundleCandidate) {
      bundlePath = path.join(exportDir, bundleCandidate)
    }
  }
  return {
    projectDir,
    manifestPath,
    bundlePath,
  }
}

function recordRecentProject(slug, title = slug) {
  const { manifestPath, bundlePath } = projectPathsForSlug(slug)
  const recentProject = {
    slug,
    title,
    manifestPath,
    bundlePath,
    updatedAt: timestamp(),
  }
  const deduped = desktopConfig.recentProjects.filter((item) => item.slug !== slug)
  desktopConfig.recentProjects = [recentProject, ...deduped].slice(0, MAX_RECENT_PROJECTS)
  desktopConfig.lastProjectSlug = slug
  persistConfig()
  buildMenu()
  if (bundlePath && existsSync(bundlePath)) {
    app.addRecentDocument(bundlePath)
  } else if (manifestPath && existsSync(manifestPath)) {
    app.addRecentDocument(manifestPath)
  }
  broadcastDesktopState()
}

function selectProjectSlug(slug) {
  if (!slug) {
    return
  }
  pendingProjectSlug = slug
  desktopConfig.lastProjectSlug = slug
  persistConfig()
  focusMainWindow()
  broadcastDesktopState()
}

function backendIconPath() {
  if (app.isPackaged) {
    return undefined
  }
  return path.resolve(__dirname, 'build', 'icon.png')
}

function spawnBackend() {
  if (app.isPackaged) {
    const executablePath = packagedBackendExecutablePath()
    return spawn(executablePath, [], {
      env: backendEnvironment(),
      stdio: 'pipe',
    })
  }

  return spawn('uv', ['run', 'python', 'run_server.py'], {
    cwd: bundledResourcePath('backend'),
    env: backendEnvironment(),
    stdio: 'pipe',
  })
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      if (response.ok) {
        return
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Backend did not become ready in time.')
}

async function startBackend({ restarting = false } = {}) {
  if (backendProcess) {
    await stopBackend()
  }

  updateSplash(restarting ? 'Recovering the local EduClaw service after an unexpected stop...' : 'Starting the local EduClaw backend and preparing your saved workspace...')
  backendProcess = spawnBackend()
  backendProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[desktop-backend] ${chunk}`)
  })
  backendProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[desktop-backend] ${chunk}`)
  })
  backendProcess.on('exit', (code) => {
    backendProcess = null
    if (!isShuttingDown && code !== 0) {
      void recoverBackend(code)
    }
  })

  await waitForBackend()
  backendRestartAttempts = 0
}

async function recoverBackend(code) {
  backendRestartAttempts += 1
  if (backendRestartAttempts > MAX_BACKEND_RESTARTS) {
    dialog.showErrorBox(
      'Backend Recovery Failed',
      `The bundled EduClaw backend exited unexpectedly with code ${code ?? 'unknown'} and could not be restarted.`,
    )
    return
  }

  try {
    await startBackend({ restarting: true })
    if (mainWindow) {
      await mainWindow.loadURL(desktopUrl())
      focusMainWindow()
    }
    await processQueuedOpenTargets()
    closeSplashWindow()
  } catch (error) {
    dialog.showErrorBox('Backend Recovery Failed', String(error))
  }
}

async function stopBackend() {
  if (!backendProcess) {
    return
  }

  const runningProcess = backendProcess
  backendProcess = null
  runningProcess.kill('SIGTERM')

  await new Promise((resolve) => setTimeout(resolve, 750))
  if (!runningProcess.killed) {
    runningProcess.kill('SIGKILL')
  }
}

async function ensureBackendRunning() {
  if (backendProcess) {
    await waitForBackend()
    return
  }
  await startBackend()
}

function createMainWindow() {
  const bounds = desktopConfig.windowBounds
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: false,
    title: 'Civic Project Studio',
    backgroundColor: '#efe6d6',
    icon: backendIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const persistWindowBounds = () => {
    if (!mainWindow) {
      return
    }
    const nextBounds = mainWindow.getBounds()
    desktopConfig.windowBounds = {
      width: nextBounds.width,
      height: nextBounds.height,
      x: nextBounds.x,
      y: nextBounds.y,
    }
    persistConfig()
  }

  mainWindow.on('resize', persistWindowBounds)
  mainWindow.on('move', persistWindowBounds)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.on('unresponsive', async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Reload App', 'Keep Waiting'],
      defaultId: 0,
      cancelId: 1,
      title: 'App Not Responding',
      message: 'EduClaw stopped responding. Reload the desktop shell and restore the last project?',
    })
    if (result.response === 0) {
      updateSplash('Reloading the desktop shell and restoring the previous session...')
      mainWindow?.reload()
    }
  })
  mainWindow.webContents.on('render-process-gone', async () => {
    updateSplash('Recovering from a renderer crash and restoring your last project...')
    recoveryState = {
      ...recoveryState,
      unclean_exit: true,
    }
    broadcastDesktopState()
    await mainWindow?.loadURL(desktopUrl())
    focusMainWindow()
    closeSplashWindow()
  })
}

async function loadDesktopShell() {
  if (!mainWindow) {
    createMainWindow()
  }
  await mainWindow.loadURL(desktopUrl())
  focusMainWindow()
  closeSplashWindow()
  broadcastDesktopState()
}

async function chooseWorkspace() {
  const result = await dialog.showOpenDialog({
    title: 'Choose Civic Project Studio Workspace',
    defaultPath: workspaceRoot,
    properties: ['openDirectory', 'createDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return getDesktopContext()
  }

  updateSplash('Switching workspace, reconnecting the local backend, and restoring recent projects...')
  workspaceRoot = primeWorkspace(ensureWorkspace(result.filePaths[0]))
  saveConfig({ workspaceRoot })
  await startBackend({ restarting: true })
  await loadDesktopShell()
  await processQueuedOpenTargets()
  return getDesktopContext()
}

async function maybePromptInstallToApplications() {
  if (!canInstallToApplications() || desktopConfig.hasSeenMovePrompt) {
    return
  }

  const choice = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Move to Applications', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Install EduClaw',
    message: 'Move Civic Project Studio into Applications so it behaves like a normal installed app?',
    detail: 'This reduces Gatekeeper friction and makes future launches feel like regular desktop software.',
  })
  saveConfig({ hasSeenMovePrompt: true })
  if (choice.response === 0) {
    const moved = app.moveToApplicationsFolder({
      conflictHandler: () => true,
    })
    if (!moved) {
      dialog.showErrorBox('Install Failed', 'The app could not be moved into Applications automatically.')
    }
  }
}

function updateProtocolRegistration() {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient('educlaw')
    return
  }
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient('educlaw', process.execPath, [path.resolve(process.argv[1] || '.')])
  }
}

function parseProjectSlugFromProtocol(target) {
  try {
    const parsed = new URL(target)
    if (parsed.protocol !== 'educlaw:') {
      return ''
    }
    if (parsed.hostname === 'project') {
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    }
    return decodeURIComponent(parsed.searchParams.get('slug') || '')
  } catch {
    return ''
  }
}

async function importProjectBundlePath(targetPath) {
  await ensureBackendRunning()
  const fileName = path.basename(targetPath)
  const payload = readFileSync(targetPath)
  const form = new FormData()
  form.append('file', new Blob([payload]), fileName)

  const response = await fetch(`${BACKEND_URL}/api/v1/studio/projects/import`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const project = await response.json()
  recoveryState = {
    ...recoveryState,
    imported_path: targetPath,
    imported_project_slug: project.slug,
  }
  recordRecentProject(project.slug, project.title)
  selectProjectSlug(project.slug)
}

async function openExternalTarget(target) {
  if (!target) {
    return
  }

  if (target.startsWith('educlaw://')) {
    const slug = parseProjectSlugFromProtocol(target)
    if (slug) {
      selectProjectSlug(slug)
      return
    }
  }

  const resolvedTarget = path.resolve(target)
  if (!existsSync(resolvedTarget)) {
    return
  }

  const stat = statSync(resolvedTarget)
  if (stat.isDirectory()) {
    workspaceRoot = primeWorkspace(ensureWorkspace(resolvedTarget))
    saveConfig({ workspaceRoot })
    await startBackend({ restarting: true })
    await loadDesktopShell()
    return
  }

  if (resolvedTarget.toLowerCase().endsWith('.cpsbundle') || resolvedTarget.toLowerCase().endsWith('-bundle.zip')) {
    await importProjectBundlePath(resolvedTarget)
    return
  }

  if (path.basename(resolvedTarget).toLowerCase() === 'project.yaml') {
    const inferredSlug = path.basename(path.dirname(resolvedTarget))
    selectProjectSlug(inferredSlug)
  }
}

async function processQueuedOpenTargets() {
  if (processingOpenTargets || queuedOpenTargets.length === 0) {
    return
  }
  processingOpenTargets = true
  while (queuedOpenTargets.length > 0) {
    const target = queuedOpenTargets.shift()
    try {
      await openExternalTarget(target)
    } catch (error) {
      dialog.showErrorBox('Open Failed', `Could not open ${target}.\n\n${String(error)}`)
    }
  }
  processingOpenTargets = false
  broadcastDesktopState()
}

function queueOpenTarget(target) {
  if (!target) {
    return
  }
  queuedOpenTargets.push(target)
  if (app.isReady()) {
    void processQueuedOpenTargets()
  }
}

function extractOpenTargetsFromArgs(argv) {
  return argv.filter((value) => {
    if (!value) {
      return false
    }
    const normalized = value.toLowerCase()
    return value.startsWith('educlaw://')
      || normalized.endsWith('.cpsbundle')
      || normalized.endsWith('-bundle.zip')
      || normalized.endsWith('project.yaml')
  })
}

function buildRecentProjectsMenu() {
  if (desktopConfig.recentProjects.length === 0) {
    return [{ label: 'No recent projects', enabled: false }]
  }
  return desktopConfig.recentProjects.map((project) => ({
    label: project.title,
    sublabel: project.slug,
    click: () => {
      selectProjectSlug(project.slug)
    },
  }))
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Choose Workspace...',
          click: () => {
            void chooseWorkspace()
          },
        },
        {
          label: 'Open Workspace Folder',
          click: () => {
            void shell.openPath(workspaceRoot)
          },
        },
        {
          label: 'Open Recent Project',
          submenu: buildRecentProjectsMenu(),
        },
        {
          label: 'Open Release Notes',
          click: () => {
            void shell.openPath(bundledResourcePath('RELEASE_NOTES.md'))
          },
        },
        canInstallToApplications()
          ? {
            label: 'Install in Applications',
            click: () => {
              void maybePromptInstallToApplications()
            },
          }
          : null,
        { type: 'separator' },
        { role: 'quit' },
      ].filter(Boolean),
    },
    {
      label: 'App',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            void checkForUpdates(true)
          },
        },
        {
          label: updateState.status === 'downloaded' ? 'Install Downloaded Update' : 'Update Not Ready',
          enabled: updateState.status === 'downloaded',
          click: () => {
            autoUpdater.quitAndInstall()
          },
        },
        {
          label: 'Launch at Login',
          type: 'checkbox',
          checked: Boolean(app.getLoginItemSettings().openAtLogin),
          click: (menuItem) => {
            setLaunchAtLogin(Boolean(menuItem.checked))
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

function setLaunchAtLogin(enabled) {
  if (typeof app.setLoginItemSettings === 'function') {
    app.setLoginItemSettings({ openAtLogin: enabled })
  }
  saveConfig({ launchAtLogin: enabled })
  buildMenu()
  broadcastDesktopState()
}

function setupAutoUpdater() {
  if (!hasUpdateConfiguration()) {
    updateDesktopState({
      status: 'unsupported',
      message: app.isPackaged
        ? 'Auto-update metadata is unavailable in this local build.'
        : 'Auto-updates are available in packaged releases.',
    })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => {
    updateDesktopState({
      status: 'checking',
      lastCheckedAt: timestamp(),
      message: 'Checking for updates...',
      error: '',
    })
  })
  autoUpdater.on('update-available', (info) => {
    updateDesktopState({
      status: 'available',
      availableVersion: info.version || '',
      message: `Downloading ${info.version || 'the latest update'}...`,
      error: '',
    })
  })
  autoUpdater.on('update-not-available', () => {
    updateDesktopState({
      status: 'not-available',
      availableVersion: '',
      message: 'You are on the latest version.',
      error: '',
    })
  })
  autoUpdater.on('download-progress', (progress) => {
    updateDesktopState({
      status: 'downloading',
      message: `Downloading update... ${Math.round(progress.percent)}%`,
      error: '',
    })
  })
  autoUpdater.on('update-downloaded', async (info) => {
    updateDesktopState({
      status: 'downloaded',
      downloadedVersion: info.version || '',
      message: `Update ${info.version || ''} is ready to install.`,
      error: '',
    })
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Install and Relaunch', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: `Civic Project Studio ${info.version || ''} has been downloaded.`,
      detail: 'Install now to relaunch into the latest EduClaw desktop build.',
    })
    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })
  autoUpdater.on('error', (error) => {
    updateDesktopState({
      status: 'error',
      message: 'Update check failed.',
      error: String(error),
    })
  })
}

async function checkForUpdates(manual = false) {
  if (!hasUpdateConfiguration()) {
    updateDesktopState({
      status: 'unsupported',
      message: app.isPackaged
        ? 'Auto-update metadata is unavailable in this local build.'
        : 'Auto-updates require a packaged release feed.',
    })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    updateDesktopState({
      status: 'error',
      message: manual ? 'Manual update check failed.' : 'Scheduled update check failed.',
      error: String(error),
    })
  }
}

async function installToApplications() {
  if (!canInstallToApplications()) {
    return false
  }
  const moved = app.moveToApplicationsFolder({
    conflictHandler: () => true,
  })
  if (moved) {
    saveConfig({ hasSeenMovePrompt: true })
  }
  return moved
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isShuttingDown = true
  saveConfig({ cleanExit: true, lastProjectSlug: desktopConfig.lastProjectSlug })
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    updateSplash('Reopening EduClaw desktop and reconnecting the local backend...')
    createMainWindow()
    await ensureBackendRunning()
    await loadDesktopShell()
    await processQueuedOpenTargets()
  } else {
    focusMainWindow()
  }
})

app.on('second-instance', (_event, argv) => {
  focusMainWindow()
  for (const target of extractOpenTargetsFromArgs(argv)) {
    queueOpenTarget(target)
  }
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  queueOpenTarget(filePath)
})

app.on('open-url', (event, target) => {
  event.preventDefault()
  queueOpenTarget(target)
})

ipcMain.handle('desktop:get-context', async () => getDesktopContext())
ipcMain.handle('desktop:choose-workspace', async () => chooseWorkspace())
ipcMain.handle('desktop:open-workspace', async () => {
  await shell.openPath(workspaceRoot)
})
ipcMain.handle('desktop:open-release-notes', async () => {
  await shell.openPath(bundledResourcePath('RELEASE_NOTES.md'))
})
ipcMain.handle('desktop:check-updates', async () => {
  await checkForUpdates(true)
  return getDesktopContext()
})
ipcMain.handle('desktop:install-update', async () => {
  if (updateState.status === 'downloaded') {
    autoUpdater.quitAndInstall()
  }
})
ipcMain.handle('desktop:set-launch-at-login', async (_event, enabled) => {
  setLaunchAtLogin(Boolean(enabled))
  return getDesktopContext()
})
ipcMain.handle('desktop:install-to-applications', async () => {
  await installToApplications()
  return getDesktopContext()
})
ipcMain.handle('desktop:track-project', async (_event, payload) => {
  if (payload?.slug) {
    recordRecentProject(String(payload.slug), String(payload.title || payload.slug))
  }
  return getDesktopContext()
})
ipcMain.handle('desktop:consume-pending-project', async (_event, slug) => {
  if (slug && pendingProjectSlug === slug) {
    pendingProjectSlug = ''
    if (recoveryState.imported_project_slug === slug) {
      recoveryState = { ...recoveryState, imported_project_slug: '', imported_path: '' }
    }
    broadcastDesktopState()
  }
  return getDesktopContext()
})

async function bootstrapDesktop() {
  loadConfig()
  recoveryState = {
    unclean_exit: desktopConfig.cleanExit === false,
    imported_path: '',
    imported_project_slug: '',
  }
  workspaceRoot = primeWorkspace(ensureWorkspace(desktopConfig.workspaceRoot || defaultWorkspaceRoot()))
  pendingProjectSlug = desktopConfig.lastProjectSlug || ''
  saveConfig({
    workspaceRoot,
    cleanExit: false,
  })
  updateProtocolRegistration()
  buildMenu()
  setupAutoUpdater()
  updateSplash('Restoring your local workspace, recent projects, and packaged backend...')
  createMainWindow()
  await ensureBackendRunning()
  await loadDesktopShell()
  await processQueuedOpenTargets()
  await maybePromptInstallToApplications()
  await checkForUpdates(false)
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer)
  }
  updateCheckTimer = setInterval(() => {
    void checkForUpdates(false)
  }, UPDATE_POLL_INTERVAL_MS)
}

if (gotLock) {
  for (const target of extractOpenTargetsFromArgs(process.argv.slice(1))) {
    queueOpenTarget(target)
  }

  app.whenReady().then(async () => {
    await bootstrapDesktop()
  }).catch((error) => {
    dialog.showErrorBox('Desktop Startup Failed', String(error))
    app.quit()
  })
}

app.on('quit', () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer)
    updateCheckTimer = null
  }
  void stopBackend()
})
