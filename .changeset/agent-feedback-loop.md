---
"@quazardous/qdadm-mcp": minor
---

An agent can drive the tab and see what its actions caused (#2247, lot A).

- **`navigate`** opens a path, or a route name with params, like a user would. It waits for the page to settle, then returns the route reached, the page title and the breadcrumb.
- **`wait_for`** waits for a route (a name, or a path prefix) or a signal matching a pattern, 30 s at most. On timeout it says where the tab is and which signals it saw.
- **Action feedback.** On the relay, `navigate`, `bridge_call` and the entity writes return a `feedback` block with what happened in the tab while the call ran: route change, console errors and warnings, page errors and unhandled rejections, toasts, missing i18n keys, failed API calls, signals. A failing call says it too.
- `recent_signals` now carries each signal's data.
- Tool arguments can be numbers.
