---
"@quazardous/qdadm": patch
---

Escape closes the delete confirmations (#2269).

The list row delete, the bulk delete, and the delete of the form and show pages now close on Escape. Nothing is deleted: Escape hides the dialog without accepting. PrimeVue's ConfirmDialog closes on Escape only when the confirmation asks for it, and none of qdadm's did.
