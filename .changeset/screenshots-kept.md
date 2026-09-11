---
"@quazardous/qdadm-mcp": minor
---

Screenshots are kept in the project (#2284). The stdio front (`qdadm-mcp-relay --stdio`), which the agent's MCP client starts in its project, writes every `screenshot` under `.aiball/screenshots/`, e.g. `20260911-112233-34fcb409-books-12-edit.jpg`, and the answer says where.

- `--no-save-screenshots` turns saving off for the front; `save: false` on the tool skips one picture.
- The relay's own `/mcp` endpoint and the dev-server endpoint write nothing: they have no project of their own.
- A failed write never fails the screenshot: the answer says why the picture was not saved.
- Add `.aiball/screenshots/` to your `.gitignore`.
- A screenshot answer now carries `_meta["qdadm/screenshot"]`: the instance and page it shows.
