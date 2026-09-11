---
"@quazardous/qdadm": patch
---

An app without `qdadmVitePlugin()` in its vite config now says so (#2259). Until now it died at boot on PrimeVue's `No PrimeVue Toast provided!`, which never named qdadm.

- In dev, the kernel logs one error, before installing PrimeVue, naming the plugin and how to add it.
- The toast listeners add the same hint to PrimeVue's error.
- The plugin defines `__QDADM_VITE_PLUGIN__` for the check.
