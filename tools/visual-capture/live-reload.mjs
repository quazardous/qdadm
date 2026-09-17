#!/usr/bin/env node
/**
 * Capture what moves on a page while it reloads from a live update (#2679).
 *
 * A glitch that lasts half a second is hard to describe and easy to guess
 * wrong. This drives headless Chromium over the DevTools protocol, triggers the
 * update, and records — for 2.5 s — every CSS transition and animation that
 * starts, every focus change, the attribute and child changes under the page,
 * and what sits at a few points of a region, frame by frame. It reads events
 * and computed styles, not pixels.
 *
 *   node tools/visual-capture/live-reload.mjs \
 *     --url http://localhost:5174/jp-users/1 \
 *     --storage 'qdadm_demo_auth={"token":"t","user":{"id":1,"username":"admin","role":"ROLE_ADMIN"}}' \
 *     --signal '{"entity":"jp_users","id":"1","action":"updated","source":"remote"}' \
 *     --region .p-tabs
 *
 * Options:
 *   --url <url>          page to open (required)
 *   --storage k=v        localStorage entry set before the app loads (repeatable) — a session, typically
 *   --signal <json>      emit entity:data-invalidate with this payload (needs debug mode: window.__qdadm)
 *   --click <text>       or click the button whose text matches, like a user would
 *   --region <selector>  where to sample what paints (default .p-tabs)
 *   --wait <selector>    wait for it before triggering (default: the region)
 *   --chromium <bin>     default chromium-browser
 *
 * Prints a JSON report on stdout: events (transitions, animations, focus), mutations, samples.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []))

const url = opt('url')
if (!url || (!opt('signal') && !opt('click'))) {
  console.error('usage: live-reload.mjs --url <url> (--signal <json> | --click <text>) [--storage k=v]... [--region sel] [--wait sel]')
  process.exit(2)
}
const region = opt('region', '.p-tabs')
const waitFor = opt('wait', region)
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'qdadm-capture-'))
const chrome = spawn(opt('chromium', 'chromium-browser'), [
  '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
  '--window-size=1400,900', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const done = async (code) => {
  // Chromium keeps writing its profile until it has exited: remove it after, not during.
  const exited = new Promise((r) => chrome.once('exit', r))
  chrome.kill()
  await Promise.race([exited, sleep(3000)])
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* a leftover temp dir is harmless */ }
  process.exit(code)
}

let wsUrl = null
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {}
  if (!wsUrl) await sleep(200)
}
if (!wsUrl) { console.error('chromium did not start'); await done(1) }

const ws = new WebSocket(wsUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
})
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails))
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
const storage = all('storage').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)] })
if (storage.length) {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: storage.map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(';') })
}
await send('Page.navigate', { url })

let ready = false
for (let i = 0; i < 100 && !ready; i++) {
  ready = await evaluate(`!!document.querySelector(${JSON.stringify(waitFor)}) && !document.querySelector('.loading-state')`).catch(() => false)
  if (!ready) await sleep(200)
}
if (!ready) { console.error(`not ready: ${await evaluate('location.href + " — " + document.body.innerText.slice(0, 200)')}`); await done(3) }
await sleep(1500) // let the first load settle

const report = await evaluate(`(async () => {
  const frame = document.querySelector(${JSON.stringify(region)})
  const origin = frame.getBoundingClientRect()
  const describe = (el) => el && el.nodeType === 1
    ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '')
    : String(el)
  const paint = (el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    return { el: describe(el), box: [Math.round(r.left - origin.left), Math.round(r.top - origin.top), Math.round(r.width), Math.round(r.height)],
      bg: cs.backgroundColor, outline: cs.outlineStyle !== 'none' ? cs.outlineColor + ' ' + cs.outlineWidth : null,
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : null, opacity: cs.opacity }
  }
  const t0 = performance.now(), at = () => Math.round(performance.now() - t0)
  const inRegion = (el) => el && el.nodeType === 1 && (frame.contains(el) || el.contains(frame))
  const events = [], mutations = [], samples = []
  const record = (type, extra) => (e) => events.push({ t: at(), type, ...extra(e), ...paint(e.target), inRegion: inRegion(e.target) })
  const listeners = [
    ['transitionrun', record('transition', (e) => ({ property: e.propertyName }))],
    ['animationstart', record('animation', (e) => ({ name: e.animationName }))],
    ['focusin', record('focus', () => ({}))],
  ]
  for (const [name, fn] of listeners) document.addEventListener(name, fn, true)

  const points = [[4, 2], [24, 2], [60, 2], [4, 20], [60, 30], [120, 40]]
  let last = '', stop = false
  const tick = () => {
    const b = frame.getBoundingClientRect()
    const snap = points.map(([dx, dy]) => document.elementsFromPoint(b.left + dx, b.top + dy).slice(0, 3)
      .map((el) => { const p = paint(el); return p.el + ' bg=' + p.bg + (p.outline ? ' outline=' + p.outline : '') + (p.boxShadow ? ' shadow=' + p.boxShadow : '') }).join(' > ')).join('\\n')
    if (snap !== last) { samples.push({ t: at(), snap }); last = snap }
    if (!stop) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  const mo = new MutationObserver((list) => { for (const m of list) mutations.push({ t: at(), type: m.type, attribute: m.attributeName, target: describe(m.target), added: m.addedNodes.length, removed: m.removedNodes.length }) })
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'tabindex', 'aria-busy'] })

  await new Promise((r) => setTimeout(r, 300))
  const trigger = at()
  const signal = ${JSON.stringify(opt('signal'))}, click = ${JSON.stringify(opt('click'))}
  if (signal) window.__qdadm.signals.emit('entity:data-invalidate', JSON.parse(signal))
  else [...document.querySelectorAll('button')].find((b) => b.textContent.includes(click)).click()
  await new Promise((r) => setTimeout(r, 2500))
  stop = true
  mo.disconnect()
  for (const [name, fn] of listeners) document.removeEventListener(name, fn, true)
  return { url: location.href, region: describe(frame), trigger, events, mutations: mutations.slice(0, 200), samples }
})()`)

console.log(JSON.stringify(report, null, 2))
ws.close()
await done(0)
