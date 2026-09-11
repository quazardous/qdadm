#!/usr/bin/env node
/**
 * Bundle size of a built qdadm app (#2265): what a first visit downloads, and everything the build holds.
 *
 *   node tools/bundle-size/measure.mjs examples/hello-world/dist [examples/tutorial-mini-admin/dist …]
 *
 * First load = the entry script, the modules it preloads and the stylesheets `index.html` links. Total = every
 * .js and .css file under the dist, lazy chunks included. Sizes are raw and gzip -9. It builds nothing and never
 * fails on a size: the release workflow runs it to print the figures, docs/production.md keeps them.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

function sizeOf(file) {
  const content = readFileSync(file)
  return { raw: content.length, gzip: gzipSync(content, { level: 9 }).length }
}

function add(total, size) {
  total.raw += size.raw
  total.gzip += size.gzip
  return total
}

function assetsUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return assetsUnder(path)
    return /\.(js|css)$/.test(entry.name) ? [path] : []
  })
}

/** A URL from index.html, whatever base the app was built with, as a file of this dist. */
function fileFor(dist, url) {
  const name = url.split('?')[0]
  for (let path = name; path; path = path.slice(path.indexOf('/', 1) + 1 || path.length)) {
    const candidate = join(dist, path.replace(/^\//, ''))
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    if (!path.includes('/', 1)) break
  }
  const byName = assetsUnder(dist).find((file) => basename(file) === basename(name))
  return byName ?? null
}

export function measure(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  const urls = [
    ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
    ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
    ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
  ].map((m) => m[1])
  const firstFiles = [...new Set(urls.map((url) => fileFor(dist, url)).filter(Boolean))]
  const first = { js: { raw: 0, gzip: 0 }, css: { raw: 0, gzip: 0 } }
  for (const file of firstFiles) add(file.endsWith('.css') ? first.css : first.js, sizeOf(file))
  const all = assetsUnder(dist)
  const total = all.reduce((sum, file) => add(sum, sizeOf(file)), { raw: 0, gzip: 0 })
  return { first, total, files: all.length }
}

const dists = process.argv.slice(2)
if (dists.length === 0) {
  console.error('usage: node tools/bundle-size/measure.mjs <dist> [<dist> …]')
  process.exit(2)
}
console.log('| App | First load JS (raw / gzip) | First load CSS (raw / gzip) | All JS + CSS (raw / gzip) |')
console.log('|---|---|---|---|')
for (const dist of dists) {
  if (!existsSync(join(dist, 'index.html'))) {
    console.log(`| ${dist} | no build | | |`)
    continue
  }
  const { first, total, files } = measure(dist)
  const app = relative(process.cwd(), dirname(join(dist, 'index.html'))).replace(/\/dist$/, '')
  console.log(
    `| ${app} | ${kb(first.js.raw)} / ${kb(first.js.gzip)} | ${kb(first.css.raw)} / ${kb(first.css.gzip)} | ` +
      `${kb(total.raw)} / ${kb(total.gzip)} (${files} files) |`
  )
}
