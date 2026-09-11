---
"@quazardous/qddebug": minor
---

The MCP tab's chat can send the agent an annotated screenshot (#2309).

- A 📷 button takes a picture of the page without the debug bar, then opens an overlay: a pen in six colours, Undo, Clear, an optional note, Cancel and Send (Escape cancels, Ctrl+Z undoes).
- Send posts the picture with the strokes as a chat message. The chat shows it as a thumbnail that opens full size.
- The overlay and the zoom are part of the debug bar, so no screenshot or page tool ever sees them.
- `RelayCollector` gains `canShoot`, `shoot()` and `sendChat(text, image?)`. A connector older than this offers no button.
