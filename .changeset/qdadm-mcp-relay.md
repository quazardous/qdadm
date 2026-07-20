---
'@quazardous/qdadm-mcp': minor
---

MCP relay for static/no-API sites (#1400): `npx qdadm-mcp-relay` accepts a
page's outbound WebSocket (token pairing) and fronts the same 13-tool MCP
(Streamable HTTP + --stdio). Opt-in browser connector at
`@quazardous/qdadm-mcp/connector` — inert without the
`#qdadm-relay=<ws-url>/<token>` URL fragment, boot-error capture included.
