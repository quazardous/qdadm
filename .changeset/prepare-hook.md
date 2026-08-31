---
"@quazardous/qdadm": patch
"@quazardous/qdadm-mcp": patch
---

Fix: the built entry points exist after a plain `npm install`, not only after `npm pack`. Pointing `exports` at `dist/` (#1895) paired it with a `prepack` hook, which npm runs when packing or publishing — but not on install. A workspace link or a `file:` dependency therefore had no `dist/`, and any bundler resolving `@quazardous/qdadm/vite` or `@quazardous/qdadm-mcp` failed with "Failed to resolve entry for package". The hook is now `prepare`, which npm runs on install *and* before pack and publish, so every consumption path gets the build.
