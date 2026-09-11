---
"@quazardous/qddebug": minor
---

The MCP tab now counts what is new (#2285).

- **The tab icon** shows the agent messages and agent requests the tab has not shown yet. It still asks for attention while a pairing code waits or something failed.
- **Sub-tabs:**
  - Chat counts the unseen agent messages;
  - History counts the unseen requests, instead of showing the total;
  - Status shows a dot while the relay is offline, something failed, or a code waits.
- Opening a sub-tab marks what it shows as seen. The marks are kept for the browser tab, so a reload does not bring old messages back as new, and what the tab held before this version is not counted.
- `RelayCollector` exposes `unseenChat`, `unseenHistory`, `statusAlert`, `markChatSeen()` and `markHistorySeen()`. Its snapshot carries `unseen: { chat, history }`.
