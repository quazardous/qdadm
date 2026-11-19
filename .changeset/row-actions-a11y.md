---
'@quazardous/qdadm': patch
---

Row actions and delete confirmations (#5323): an icon-only row action now has an accessible name, its tooltip label (`ariaLabel` on an action overrides it), so a screen reader says it and a test finds it by role and name. The delete confirmations of the list, form and show pages name their buttons Delete / Cancel from the catalogue instead of PrimeVue's English Yes / No, and the bulk delete's message and title are in the catalogue too.
