import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, '..')
const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-builder', ...process.argv.slice(2)],
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
