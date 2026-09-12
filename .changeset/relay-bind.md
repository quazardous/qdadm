---
"@quazardous/qdadm-mcp": minor
---

`--bind <host>` / `QDADM_RELAY_HOST`: the interface the relay listens on (#2400).

`127.0.0.1` by default, unchanged — a browser and its agent usually sit on this machine. A relay **inside a container** needs `0.0.0.0`: a loopback socket refuses what Docker forwards to it, so a published port is unusable however fixed it is, and the failure is silent (`docker-proxy` accepts, nothing answers).

```bash
QDADM_RELAY_PORT=35173 QDADM_RELAY_HOST=0.0.0.0 npm run dev   # in the container
QDADM_RELAY_URL=http://localhost:35173 npx qdadm-mcp-relay --stdio   # agent on the host
```

Binding wider is a door, and the relay says so when it starts: tabs still need the page token, and `--origin` limits which pages may pair. `GET /identity` is the honest check that something is really answering.

The qdadm-mcp README has the container layout end to end, and the version range to write while this package is on `0.x` (`^0.6.0` does not reach `0.7.0`).
