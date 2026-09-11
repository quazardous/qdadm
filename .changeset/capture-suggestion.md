---
"@quazardous/qdadm-mcp": minor
---

The debug bar can offer real screenshots when an agent needs them (#2318).

- `window.__qdadmRelay.capture.onSuggest(listener)` is called when an agent's `screenshot` came out rendered from the page because no tab capture runs. The agent's picture does not wait for it.
- `capture.supported` says whether the browser can capture a tab at all.
