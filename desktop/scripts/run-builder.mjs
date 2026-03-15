import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, '..')
const cliArgs = [...process.argv.slice(2)]

function hasMacSigningCredentials() {
  return Boolean(
    process.env.CSC_LINK
      || process.env.CSC_NAME
      || process.env.APPLE_ID
      || process.env.APPLE_TEAM_ID,
  )
}

if (process.platform === 'darwin' && !hasMacSigningCredentials()) {
  // Local unsigned builds should remain launchable without Apple credentials.
  cliArgs.push('-c.mac.hardenedRuntime=false')
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-builder', ...cliArgs],
  {
    cwd: desktopDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: ''
    }
  }
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
