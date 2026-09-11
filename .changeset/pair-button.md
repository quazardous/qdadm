---
"@quazardous/qddebug": minor
"@quazardous/qdadm": minor
---

The debug bar gets an **MCP** tab (#2231), after i18n, where the app installed `@quazardous/qdadm-mcp/connector`. No connector, no tab.

It shows how this browser tab reaches the relay:
- **Dev page:** connected, with its instance id and the relay; or offline and retrying.
- **Other pages:** **Pair**, then the code to give the agent, then **Unpair**. It also says when no relay answered, or when the browser holds the connection back: on a public https origin, Chrome waits for the user to allow local network access.

The tab's **instance id** sits at the top of the panel: click it to copy it, and give it to your agent when several tabs are open. Three sub-tabs sit under it:
- **Status**: the connection;
- **Chat**: with the agent, badged while its messages are unread;
- **History**: every MCP request the tab served, with tool, detail, success or error, and duration. Its badge lights while a code waits or on an error.

`RelayCollector` and `RelayPanel` are exported from qddebug. The collector redacts the code from `snapshot()` and its actions: the debug bridge is readable over HTTP and MCP, and a code must reach the agent through a human. `debugBar({ relayCollector: false })` hides the tab.
