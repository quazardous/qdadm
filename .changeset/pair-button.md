---
"@quazardous/qddebug": minor
---

The debug bar gets a **Pair MCP** button (#2231). It appears only when `@quazardous/qdadm-mcp/connector` is installed, and drives the pairing through `window.__qdadmRelay`.

It shows the code to give the agent, says when no relay answered, and says when the browser holds the connection back: on a public https origin, Chrome waits for the user to allow local network access.
