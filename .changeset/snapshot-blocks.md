---
"@quazardous/qdadm-mcp": minor
---

`page_snapshot` shows which block of a zone rendered what (#2363).

- Under a `zone` line, each block marked by qdadm's `Zone` becomes `block "export-btn" [ExportButton (src/…/ExportButton.vue)]`, with what it renders below it. An async block is named once it has loaded.
- The zone line drops its `[blocks: …]` summary when its blocks are marked. Zones rendered by an older qdadm keep it.
- The `interactive` list says `— in zone "…", block "…"`, and `find` gives the block as context.
