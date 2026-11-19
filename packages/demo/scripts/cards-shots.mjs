#!/usr/bin/env node
/**
 * Shots of the cards' gallery (#5339), for review: one PNG per card × state ×
 * size × theme, in shots/cards/. No pixel comparison: the look is judged by
 * eye while it moves.
 *
 *   npm run dev                 # the demo on http://localhost:5191 (or BASE=…)
 *   npm run cards:shots         # signs in as the demo's admin, opens /cards
 *
 * Env: BASE (default http://localhost:5191), CHROME (the browser binary),
 * OUT (default shots/cards).
 *
 * It drives a headless Chromium over the DevTools protocol, with nothing to
 * install: Node's own WebSocket and fetch.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE ?? 'http://localhost:5191'
const OUT = resolve(process.env.OUT ?? join(here, '..', 'shots', 'cards'))
const CHROME =
  process.env.CHROME ??
  ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
if (!CHROME) {
  console.error('cards:shots: no Chromium found; set CHROME to its binary')
  process.exit(2)
}
// The demo's own fixture account, on the demo's local server
const admin = JSON.parse(readFileSync(join(here, '..', 'src', 'fixtures', 'users.json'), 'utf8')).find((u) => u.role === 'ROLE_ADMIN')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'cards-shots-'))
const port = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1400,1000', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })

try {
  let targets = []
  for (let i = 0; i < 50 && !targets.length; i++) {
    try {
      targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page')
    } catch {
      await sleep(200)
    }
  }
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
  const waitFor = async (expression, ms = 15000) => {
    for (let t = 0; t < ms; t += 200) {
      if (await ev(expression)) return true
      await sleep(200)
    }
    return false
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/login` })
  if (!(await waitFor(`!!document.getElementById('qdadm-username')`))) throw new Error(`no login form at ${BASE}/login: is the demo running?`)
  const fill = (id, value) => ev(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  await fill('qdadm-username', admin.username)
  await fill('qdadm-password', admin.password)
  await ev(`document.querySelector('button[type=submit]').click()`)
  await waitFor(`location.pathname !== '/login'`)

  await send('Page.navigate', { url: `${BASE}/cards` })
  if (!(await waitFor(`document.querySelectorAll('[data-gallery-card]').length > 0`))) throw new Error('no gallery at /cards')
  await sleep(800)

  const tiles = await ev(`[...document.querySelectorAll('[data-gallery-card]')].map((el, i) => {
    el.setAttribute('data-shot', i)
    return { i, card: el.dataset.galleryCard, state: el.dataset.galleryState, size: el.dataset.gallerySize, theme: el.closest('[data-gallery-theme]')?.dataset.galleryTheme ?? 'light' }
  })`)
  mkdirSync(OUT, { recursive: true })
  for (const tile of tiles) {
    const box = await ev(`(() => { const el = document.querySelector('[data-shot="${tile.i}"]'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height } })()`)
    await sleep(60)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 1 } })
    const file = join(OUT, `${tile.card}-${tile.state}-${tile.size}-${tile.theme}.png`)
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
  }
  console.log(`cards:shots: ${tiles.length} shots in ${OUT}`)
  ws.close()
} finally {
  // Chromium still writes its profile while it exits
  const exited = new Promise((r) => chrome.once('exit', r))
  chrome.kill()
  await Promise.race([exited, sleep(5000)])
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
