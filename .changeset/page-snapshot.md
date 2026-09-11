---
"@quazardous/qdadm-mcp": minor
---

Read the page like the user sees it, on the relay (#2247):

- `page_snapshot` returns the tab as an accessibility tree, one line per element: role, name, states (checked, disabled, expanded or collapsed, required, invalid, current, focused…) and value, e.g. `- textbox "Title" [required] [invalid] [value="Dune"] [ref=e9]`. Every element carries a ref that stays valid while the element lives; a re-rendered one fails with a message saying to take a new snapshot. `filter: "interactive"` lists only what can be acted on; `ref` reads one part; long tables keep their first rows. Fields in error are listed at the end, label first. The debug bar is left out.
- `find` looks elements up by role and/or text, and says where each sits (its row, dialog, form).
- `page_text` returns the visible text.

The three answer as plain text, not JSON. Names and roles come from `dom-accessibility-api`, loaded by the page on first use; `qdadmMcpPlugin` pre-bundles it so the first snapshot cannot make vite reload the page.
