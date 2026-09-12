---
"@quazardous/qdadm-mcp": minor
---

`QDADM_RELAY_PORT` runs a relay of your own, on a port you choose.

```bash
QDADM_RELAY_PORT=50000 npm run dev
claude mcp add qdadm -e QDADM_RELAY_PORT=50000 -- npx qdadm-mcp-relay --stdio
```

It is a full relay — run file, lock, tabs, agents — but not the machine's default one: its run file is `~/.qdadm_relay.50000.run`, so relays on different ports ignore each other and a project can have one of its own. Unlike `--port`, which has no run file and which nothing finds on its own.

Whoever starts the relay needs the variable: the dev server and the agent's MCP client both can, so set it on both, or the agent talks to the default relay and sees none of your tabs. A value that is not a port is refused instead of falling back to 47761.

See the qdadm-mcp README, "Running the relay on a port you choose".
