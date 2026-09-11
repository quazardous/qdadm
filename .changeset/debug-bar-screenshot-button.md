---
"@quazardous/qddebug": minor
---

A 📷 among the debug bar's own buttons, and a prompt for real screenshots (#2318).

- **📷 Screenshot** sits between Pause and Clear all, whatever tab is open, when an MCP connector can take pictures. Circle what you mean, add a note, Send: the picture goes to the agent's chat, and the bar opens on MCP → Chat. The 📷 in the chat input row is gone.
- **Without a real capture, it asks first.** Allow real screenshots opens the browser's share prompt, and the prompt stays open until the tab is shared: a refused share says so. Continue without takes a picture rendered from the page, and is remembered for the browser tab.
- **When an agent's screenshot is rendered from the page,** the same offer shows in a corner. It blocks nothing, goes away after 10 s, and comes back at most once a minute.
