---
"@quazardous/qdadm-mcp": minor
---

The relay's address stops being assumed to be `localhost` in two places (#2404).

- **The relay says where it listens.** Its `host` is now in the run file and in `GET /identity`, written by the one process that knows.
- **The dev server's line reports it** instead of printing `ws://localhost:<port>` whatever the bind — with the address pages were given (`QDADM_RELAY_PUBLIC_URL`) when there is one, and a word about what `0.0.0.0` means when there is not. That line is what most people read, and in a container it was naming an address that could not work.
- **A saved pairing keeps the address it paired with**, so a reload dials that relay instead of looking for a local one. Pairings saved before this keep their old behaviour.

Found by BookShepherd while verifying a container setup end to end.
