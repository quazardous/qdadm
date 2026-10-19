---
"@quazardous/qdadm": minor
---

feat(display): `PayloadViewer` and `PayloadDiff`, captured messages in their own format (#4112). The viewer detects the format from the prop, the content type or the body itself, and renders JSON through `JsonViewer`, XML indented and highlighted (tokenized by hand, never handed to the DOM), CSV as a table (separator detection, quoted and multi-line fields), form-encoded data as key/value pairs, text with line numbers, and binary content as a hex preview with a download. It shows the HTTP method, URL, status and headers when given. A `mask` hook (`maskKeys()` for the usual secrets) hides values before display, copy and download. The diff normalizes both sides (sorted JSON keys, indented XML, sorted form fields) before a line diff, side by side or inline, with unchanged runs folded. With `csv-key`, CSV rows are matched on a column and compared cell by cell.
