---
"@quazardous/qdadm-mcp": minor
---

One relay per machine between your app's tabs and your agents (#2231).

**`npm run dev` starts it, and connects the app to it.** `qdadmMcpPlugin()` starts the relay if none is running, detached, so it outlives dev-server restarts. Every page the dev server serves connects at startup, with no click and no code. `relay: false` opts out.

**Agents attach through the MCP stdio server `npx qdadm-mcp-relay --stdio`** (Claude Code: `claude mcp add qdadm -- npx qdadm-mcp-relay --stdio`). The stdio server attaches to the running relay, or starts one, and never fails at startup. Claude Code does not retry an MCP server that failed when the session started; only `/mcp › Reconnect` brings it back.

**Instances.**
- Every connected tab is an instance, with an id kept across reloads.
- New `instances` tool: id, app, page, origin, how each connected, connected or reloading.
- Every tool takes `instance` (an id, or its first 8 characters). Leave it out while a single instance is connected; with several, the error lists them.
- `session` is still accepted as a synonym.
- A reloading tab stays known for 30 s, and tools answer "reloading — retry" meanwhile.

**The relay.**
- Listens on the first free port of `47761–47765`, `127.0.0.1` only, and never crashes on a port in use.
- That single port carries tab WebSockets, `GET /identity`, and `POST /mcp`, which refuses any request with an `Origin` header. `--mcp-port` is gone.
- It writes `~/.qdadm_relay.run` (pid, port, page token, log; mode 0600; `QDADM_RELAY_RUN` to move it) and removes it on exit. A lock keeps a single relay.
- Started in the background, it stops after 30 idle minutes.
- The launcher runs the built relay when installed, so it no longer needs Node ≥ 22.18.

**Chat.** `chat_send` shows a message in the tab's MCP panel, and `chat_read` returns what the user typed there since the last read. Every request a tab serves is also kept in its MCP history. Both survive reloads.

**Outside dev** (static build, preview), a tab pairs from the debug bar's MCP tab: **Pair** shows a code, the user reads it to the agent, the agent calls `pair_accept`. The code never reaches the agent. `--origin` restricts who may pair. The `#qdadm-relay=…/<token>` fragment still connects a tab directly.
