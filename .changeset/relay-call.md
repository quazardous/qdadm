---
"@quazardous/qdadm-mcp": minor
---

`qdadm-mcp-relay --call <tool> '<json args>'` makes one MCP tool call from a shell, then exits (#2263).

It takes the agent's own path: the machine relay is found or started, and a screenshot is kept under `.aiball/screenshots/`. It prints the tool's text answer and exits 0, or 1 when the tool answered with an error, or 2 on a wrong command (the arguments are not a JSON object, or the tool name is unknown, with the known ones listed). Useful for scripts, demos and CI checks.
