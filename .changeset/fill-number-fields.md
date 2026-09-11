---
"@quazardous/qdadm-mcp": patch
---

`fill` on a number field does what a user would (#2315).

- **It leaves the field after typing.** PrimeVue's InputNumber keeps the typed value only when the field loses focus. Until now Save stayed disabled until the agent pressed Tab.
- **It types the page's own decimal separator.** `"12.5"` and `"12,5"` both work, even on a page that writes decimals with a comma while the browser language says `en-US`. The answer says when it converted.
- **It says when a field ends up holding something else than asked,** e.g. `— but it holds "125", not "12.5"`. Formatting of the same number (`"12,50"` for `12.5`) is not reported.
