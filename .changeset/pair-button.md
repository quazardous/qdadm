---
"@quazardous/qddebug": minor
"@quazardous/qdadm": minor
---

The debug bar gets an **MCP** tab (#2231), after i18n, where the app installed `@quazardous/qdadm-mcp/connector` — no connector, no tab.

**Pair** shows the code to give the agent, then who the tab is paired with and an **Unpair** button. The tab also says when no relay answered, and when the browser holds the connection back: on a public https origin, Chrome waits for the user to allow local network access. Its badge lights while a code waits.

`RelayCollector` and `RelayPanel` are exported from qddebug. The collector redacts the code from `snapshot()` and its actions: the debug bridge is readable over HTTP and MCP, and the code must reach the agent through a human. `debugBar({ relayCollector: false })` hides the tab.
