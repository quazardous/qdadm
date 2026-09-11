---
"@quazardous/qdadm-mcp": minor
---

`qdadm-mcp-relay --chat-hook stop` is a Stop hook for agents that support hooks, such as Claude Code (#2252). When the agent is about to stop and the user wrote in a tab's MCP chat without an answer, it blocks the stop and gives the message as the reason, so the agent answers with `chat_send`.

- Each message stops the agent once; `chat_read` still returns it.
- With no relay, no tab or nothing new, the hook prints nothing and never gets in the way.
- The relay serves it on `POST /chat/pending`, refused to web pages like `/mcp`.
