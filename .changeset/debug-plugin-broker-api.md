---
'@quazardous/qdadm': minor
---

Debug plugin: inter-plugin broker api + typed page-side queries (#1398)

`qdadmDebugPlugin` exposes its ws broker through the standard Vite plugin
`api` (consumed by @quazardous/qdadm-mcp), and the injected client gains
typed, bridge-independent handlers: sessionInfo, routes, entityState,
entityCall, storageDump, recentSignals, and a boot log buffered from
BEFORE the app boots (console/page errors visible even when the app dies
pre-bridge). Unknown subpaths under /__qdadm now fall through so sibling
plugins can mount their own endpoints.
