---
"@quazardous/qdadm-mcp": minor
---

`force: true` on `click`, `hover`, `drag`, `type_text` and `fill` (#2274): act even if the element is covered, not visible, disabled or read-only.

- The answer lists what was skipped under `forced`, e.g. `["was covered by button \"Leave\" [ref=e56] in dialog …"]`, and the MCP history marks the request `force`.
- Some things a forced action still cannot do, and the answer says so. A read-only field keeps its value, as it would for a real user, and the answer gives the value it holds. A click that never reaches the element is reported as such.
- A stale ref and the debug bar stay refused.
- A refusal without `force` now mentions that `force` exists.
