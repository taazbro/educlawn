import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '..', '..', 'backend')
const desktopDir = path.resolve(__dirname, '..')

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit'
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code ?? 1}`))
    })
  })
}

await run('uv', ['run', 'python', 'scripts/create_desktop_bootstrap.py', path.join(desktopDir, 'bootstrap')], backendDir)
await run(
  'uv',
  [
    'run',
    '--with',
    'pyinstaller',
    'python',
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onedir',
    '--name',
    'educlawn-backend',
    'run_server.py'
  ],
  backendDir
)
