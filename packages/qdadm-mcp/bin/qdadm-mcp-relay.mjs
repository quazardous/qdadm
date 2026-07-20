#!/usr/bin/env node
// qdadm-mcp-relay (#1400) — thin launcher. The implementation is TypeScript
// consumed via Node's native type stripping (Node >= 22.18).
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`qdadm-mcp-relay requires Node >= 22.18 (type stripping); found ${process.versions.node}`)
  process.exit(1)
}
const { main } = await import('../src/relay/cli.ts')
await main()
