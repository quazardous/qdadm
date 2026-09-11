#!/usr/bin/env node
// qdadm-mcp-relay (#1400, #2231) — thin launcher.
//
// Installed (under node_modules) it runs the built relay: Node refuses to strip
// types there. In a source checkout it runs the TypeScript directly when Node
// can (>= 22.18), so an edit needs no rebuild — and falls back to dist/.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(import.meta.url)
const built = new URL('../dist/relay/cli.js', import.meta.url)
const source = new URL('../src/relay/cli.ts', import.meta.url)
const [major, minor] = process.versions.node.split('.').map(Number)
const canStripTypes = major > 22 || (major === 22 && minor >= 18)
const useSource = !here.includes('/node_modules/') && canStripTypes && existsSync(source)

if (!useSource && !existsSync(built)) {
  console.error(
    `qdadm-mcp-relay: no built relay (dist/) and Node ${process.versions.node} cannot run the TypeScript source ` +
      '(needs >= 22.18). Run `npm run build` in @quazardous/qdadm-mcp.'
  )
  process.exit(1)
}

const { main } = await import((useSource ? source : built).href)
await main()
