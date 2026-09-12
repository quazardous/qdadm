---
"@quazardous/qdadm-mcp": minor
---

`QDADM_RELAY_PUBLIC_URL`: the address the dev server tells its pages to dial (#2400).

For a relay in a container whose browser is on the host. The relay stays local — started by the plugin, its token read from its run file, so **no token to pass around** — and only what pages are told changes:

```bash
QDADM_RELAY_PORT=35173 QDADM_RELAY_HOST=0.0.0.0 \
  QDADM_RELAY_PUBLIC_URL=ws://relay.example.localhost:8500 npm run dev
```

`<prefix>/relay.json` carries that URL, the connector dials it instead of scanning the loopback, and a failure names the URL that did not answer instead of a port it never tried. Left unset, pages behave exactly as before.

`QDADM_RELAY_URL` now accepts `ws://` and `wss://` as well, so one address can be handed to an agent and to a page alike. It remains the other question: *the relay is elsewhere, start none* — while `QDADM_RELAY_PUBLIC_URL` means *the relay is here, but the browser reaches it there*.

The qdadm-mcp README has the container layout end to end, including what a proxy must forward and why its entrypoint belongs on the host's loopback.
