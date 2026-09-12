---
"@quazardous/qdadm-mcp": minor
---

`QDADM_RELAY_URL` tells the agent's front where the relay is, when a proxy stands between them (#2401).

```bash
QDADM_RELAY_URL=https://dev.example.com/qdadm npx qdadm-mcp-relay --stdio
```

The relay itself is unchanged — it stays on `127.0.0.1` next to the browser it drives. Only the front's side of the wire moves: it posts to `<url>/mcp`, keeping the base's path so a proxy prefix survives, wins over `QDADM_RELAY_PORT`, reads no run file, and starts no relay of its own — one here would answer about a browser nobody is watching. A call that cannot get through says which URL did not answer, and a value that is not an http(s) URL is refused instead of falling back to the local relay.

See the qdadm-mcp README, "Behind a proxy".
