---
"@quazardous/qdadm-mcp": patch
---

`page_snapshot` and `find` list password, date, time, datetime-local, month, week, color and file inputs (#2291). These inputs have no ARIA role, so the snapshot left them out, and an agent had no ref for them.

- They are listed as Playwright's snapshot lists them, with their type: `textbox "Password" [type=password] [required] [value="••••••"]`, `textbox "Due" [type=date]`, `button "Cover" [type=file]`. A password's value is never shown.
- Action messages name them the same way, e.g. `set textbox "Due" [type=date] to "2026-09-11"`, instead of `date input "Due"`.
