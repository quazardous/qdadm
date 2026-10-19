/**
 * A worker that writes a log in the background, and the endpoint that reads
 * it: `poll(from)` answers `{ lines, next, done }`, as a backend's
 * `GET /tasks/<id>/log?from=<n>` would.
 */
const C = { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m' }

const STEPS = [
  ['Allocating box', 4],
  ['Cloning ref feature/checkout-v2', 10],
  ['Installing dependencies', 18],
  ['Restoring database snapshot', 12],
  ['Running migrations', 9],
  ['Warming caches', 6],
  ['Starting services', 5],
]

function stamp() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z')
}

/** Start a fake task; `fail` makes the migrations step break. */
export function startFakeTask({ fail = false, speedMs = 250 } = {}) {
  const lines = []
  let done = false
  const script = []
  STEPS.forEach(([title, count], s) => {
    script.push(`${C.bold}${C.blue}==> [${s + 1}/${STEPS.length}] ${title}${C.reset}`)
    for (let i = 1; i <= count; i++) {
      if (title === 'Installing dependencies' && i === 7) script.push(`${C.yellow}WARN${C.reset} deprecated package left-pad@1.3.0`)
      if (fail && title === 'Running migrations' && i === 6) {
        script.push(`${C.red}${C.bold}ERROR${C.reset} migration 2026_10_19_add_sku_index failed: duplicate key value violates unique constraint`)
        script.push(`${C.red}FATAL${C.reset} task aborted`)
        return
      }
      script.push(`${C.dim}  ${title.toLowerCase()} ${i}/${count}${C.reset} ${C.cyan}${(Math.random() * 900 + 100).toFixed(0)} ms${C.reset}`)
    }
    script.push(`${C.green}✔${C.reset} ${title} done`)
  })

  let at = 0
  const timer = setInterval(() => {
    const burst = 1 + Math.floor(Math.random() * 3)
    for (let k = 0; k < burst && at < script.length; k++) lines.push(`${stamp()} ${script[at++]}`)
    if (at >= script.length) {
      if (!fail) lines.push(`${stamp()} ${C.green}${C.bold}Box ready${C.reset} at https://checkout-v2.stagebox.test (a very long line follows to try wrapping: ${'lorem ipsum '.repeat(20)})`)
      done = true
      clearInterval(timer)
    }
  }, speedMs)

  return {
    poll: async (from) => {
      await new Promise((r) => setTimeout(r, 30))
      return { lines: lines.slice(from), next: lines.length, done: done && from + lines.slice(from).length >= lines.length }
    },
    stop: () => clearInterval(timer),
  }
}

/** A finished log of `count` lines, to try scrolling and search on a big one. */
export function bigLog(count = 30000) {
  const out = []
  const t0 = Date.parse('2026-10-19T08:00:00Z')
  for (let i = 0; i < count; i++) {
    const ts = new Date(t0 + i * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
    if (i % 997 === 500) out.push(`${ts} ${C.red}ERROR${C.reset} request ${i} timed out after 30000 ms`)
    else if (i % 211 === 3) out.push(`${ts} ${C.yellow}WARN${C.reset} slow query (${i % 900} ms) on orders`)
    else out.push(`${ts} ${C.dim}INFO${C.reset} GET /api/orders/${i} 200 ${(i * 7) % 120} ms`)
  }
  return out
}
