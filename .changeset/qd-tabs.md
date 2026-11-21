---
"@quazardous/qdadm": minor
---

`QdTabs`: tabs on a page of the app's own, over PrimeVue's Tabs. The current tab is in the address (`?tab=…`, replaced, so no history entry), a badge per tab (`QdBadge`, toned, hidden at zero), a tab with `permission` is not drawn for a user without it, and a panel mounts when first opened, then stays. `v-model`, `query` (or `false`) and `lazy` are its props.
