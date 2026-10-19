---
"@quazardous/qdadm": patch
---

fix(debug): the debug bar component no longer triggers "Vue received a Component that was made a reactive object" on every page load (#4117). It was held in a deep `ref`, which wrapped it in a reactive proxy; it is now kept in a `shallowRef` and marked raw.
