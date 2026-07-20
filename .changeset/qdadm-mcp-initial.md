---
'@quazardous/qdadm-mcp': minor
---

Initial release: MCP server for running qdadm apps (#1398)

`qdadmMcpPlugin()` (vite dev plugin) exposes a stateless Streamable-HTTP
MCP endpoint at `/__qdadm/mcp` over qdadm's debug broker. Curated toolset —
session_info, boot_errors, routes, entity_state, entity_list/get/create/
update/delete (readOnly option), storage_dump, recent_signals, describe,
bridge_call — every response session-stamped. Dev-server only by
construction; works behind an HTTPS vhost/proxy.
