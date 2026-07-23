---
"@quazardous/qdadm-mcp": minor
---

Agent-grade error messages across the toolset (#1497, skybot testbed feedback). Tool registration moves to the low-level MCP Server: advertised JSON Schema keeps `required` correctly declared, and argument validation is now ours — failures come back as one actionable sentence (no more raw ZodError dumps), with the registered entity names appended when an `entity` argument is missing and a session is reachable. `boot_errors` tells the truth: its description and its no-session message now say it needs an open tab — a blank page counts, the pre-boot capture loads before the app. Minor (not patch): the exported `ToolDef` shape changed (plain `args` specs replace zod `inputSchema`).
