/**
 * Runs the backend and the Vite dev server together, so `npm run live` is one
 * command. No `concurrently` dependency: two child processes and a shared
 * exit are enough, and an example should not teach you to install a tool for
 * something the stdlib does.
 */
import { spawn } from 'node:child_process'

const children = [
  spawn('node', ['server.mjs'], { stdio: 'inherit', cwd: import.meta.dirname }),
  spawn('npx', ['vite'], { stdio: 'inherit', cwd: import.meta.dirname }),
]

const stopAll = () => {
  for (const child of children) child.kill('SIGTERM')
}

process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)

// If either half dies, the demo is meaningless — take the other one down too
// rather than leaving a half-running app that looks merely broken.
for (const child of children) {
  child.on('exit', (code) => {
    stopAll()
    process.exit(code ?? 0)
  })
}
