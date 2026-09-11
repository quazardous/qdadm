---
"@quazardous/qdadm": patch
---

A lazy page whose chunk fails to load no longer leaves a blank screen (#2295). This typically happens in a tab left open across a deploy: the old build asks for chunks that no longer exist.

- qdadm reloads the page once, at the page the user was going to, which loads the new build.
- If that page fails again, it does not reload a second time. It shows an error toast that stays until dismissed: "A new version is available — This page could not be loaded. Reload the page to get the new version."
- The guard is a sessionStorage flag, cleared by the next navigation that succeeds. Without sessionStorage, it only shows the toast.
- Vite's `vite:preloadError` is handled the same way. Other navigation errors are left alone.
