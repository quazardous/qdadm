---
'@quazardous/qdadm': minor
---

Show-page actions take a `tooltip` (#5436), like the row actions: a string or a function of the record, read at each render, shown on hover in the header and the footer. A disabled action keeps it, on a focusable wrapper carrying the text in its aria-label. No tooltip when absent.
