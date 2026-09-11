---
"@quazardous/qdadm-mcp": minor
---

Pair the agent with ONE browser tab, from the debug bar (#2231).

**The relay is now the agent's tool.** `claude mcp add qdadm -- npx qdadm-mcp-relay --stdio`: the relay lives as long as the agent session, so restarting the app no longer takes the MCP server away. Claude Code does not retry an HTTP MCP server that was down when the session started; only `/mcp › Reconnect` brings it back.

**Pairing.**
- In the app, the debug bar's **MCP** tab scans the relay ports and shows a code. The user reads it to the agent, which calls the new `pair_accept` tool.
- The relay never gives codes to the agent (`pairing_status` lists waiting tabs without them), so every pairing goes through the human.
- One paired tab at a time. It is the default target of every tool, and it survives reloads: the tab re-presents its pairing key, and tools answer "reloading — retry" meanwhile instead of "no session".
- `session_info` reports the pairing.

**Relay CLI.**
- The WebSocket listener walks `47761–47765` instead of one fixed port, and never crashes on `EADDRINUSE`. `--port` still pins one port; a non-default port needs `installQdadmRelayConnector({ ports: [...] })`.
- Both listeners bind to `127.0.0.1` only.
- `--origin <origin>` (repeatable) restricts which pages may pair. A connection without an `Origin` header cannot pair.

**Connector.**
- `installQdadmRelayConnector()` exposes `window.__qdadmRelay` and does nothing else until a pairing exists: no socket, no console wrapper.
- A tab paired before re-pairs on load, before the app runs, so boot capture still sees a crash during boot.
- The tab's instance id is kept in `sessionStorage`.
- The `#qdadm-relay=…/<token>` fragment still works. Its default port moved with the relay; the startup log prints the fragment to use.
