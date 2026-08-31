/**
 * Runs the backend and the Vite dev server together, loading .env for both.
 * No dependency: two child processes and a shared exit are enough, and an
 * example should not teach you to install a tool the stdlib replaces.
 */
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = import.meta.dirname
const envPath = join(dir, '.env')

if (!existsSync(envPath)) {
  console.error('[google-login] no .env — copy .env.example and fill it in from the Google console.')
  process.exit(1)
}

// Minimal .env reader: KEY=value, # comments, blank lines.
const env = { ...process.env }
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
}

const children = [
  spawn('node', ['server.mjs'], { stdio: 'inherit', cwd: dir, env }),
  spawn('npx', ['vite'], { stdio: 'inherit', cwd: dir, env }),
]

const stopAll = () => children.forEach((c) => c.kill('SIGTERM'))
process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)

// Half a demo running is worse than none: it merely looks broken.
for (const child of children) {
  child.on('exit', (code) => {
    stopAll()
    process.exit(code ?? 0)
  })
}
