---
"@quazardous/qdadm": minor
---

Each block of a `Zone` renders inside a marker, `<div data-zone-block="<id>" style="display: contents">` (#2363).

The marker adds no box, so the layout is unchanged. It lets the debug tools and the MCP's `page_snapshot` tell which block rendered what, including blocks with several root elements. A CSS child selector aimed at a block's root, like `.qdadm-zone > .my-block`, now goes through the marker: `.qdadm-zone > [data-zone-block] > .my-block`.
