---
"@quazardous/qdadm-mcp": minor
"@quazardous/qddebug": minor
---

`screenshot`, on the relay (#2247): a picture of the tab that the agent receives as an MCP image. It covers the viewport by default, one element with `ref`, or the whole page with `fullPage`.

- By default the picture is rendered from the page's DOM by snapdom, loaded on the first screenshot. It needs no permission, and the debug bar is left out.
- For the real pixels, the user clicks **Allow real screenshots** in the MCP tab of the debug bar. The browser asks them to share the tab, and screenshots use that capture until they click **Stop sharing**.
- `source` forces either kind (`dom` or `tab`); `format` and `quality` set the encoding.
- Pictures are kept to 1600 px on their longest edge.
