---
'@quazardous/qdadm': minor
---

qdadmVitePlugin `primevue` flavor option (#1393): alias every `primevue/*`
import to a compatible fork (e.g. `openvue`) from the consumer config —
qdadm officially tests primevue@4 only, other flavors are the consumer's
adaptation. `primevue` peer is now optional so flavor-only installs don't
fight npm.
