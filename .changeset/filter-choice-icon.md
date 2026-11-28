---
"@quazardous/qdadm": minor
---

A filter choice's icon (#5578): `icon: 'pi pi-users'` on a choice is drawn before its label, in the open list and in the field, by the plain select, QdMultiFilter (its chosen ones too) and QdSearchFilter; choices read from `optionsEndpoint`, `searchEndpoint` and `searchOptions` keep it. `labelFor(value)` may give `{ label, icon }` for a value that is no choice.
