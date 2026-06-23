---
"@quazardous/qdadm": minor
---

Add `i18n.emitMissing` option (default `true`) to silence the `i18n:missing` debug signal (qdadm #1048).

In an untranslated app, every unresolved key fires `i18n:missing`, flooding the debug panel's "Missing" section. Set `new Kernel({ i18n: { emitMissing: false } })` to suppress that stream. No functional impact — only the debug collector consumes the signal, so the section just stays empty; `i18n:domain-loaded`, `locale:changed`, and the inbound `locale:change` listener are unaffected.
