---
"@quazardous/qdadm-mcp": minor
---

The user can send the agent an annotated screenshot through the MCP tab's chat (#2309).

- The controller's `chat.shoot()` takes a picture of the viewport for the MCP tab to annotate. It is rendered without the debug bar, or uses real pixels while a tab capture runs. `chat.send(text, image?)` posts it.
- `chat_read` returns the new messages with each screenshot as MCP image content, and the message says `"screenshot": "image 1 below"`. The stdio front keeps those pictures in `.aiball/screenshots/` too (`…-chat.jpg`).
- The Stop hook mentions it: `(with an annotated screenshot: read it with chat_read)`.
- The chat keeps the last 5 screenshots for the tab. When the tab's storage is full, older ones are dropped first, never the text, and the message says `imageDropped`.
