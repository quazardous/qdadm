---
"@quazardous/qdadm": patch
---

Overlapping reloads no longer put a past state on screen (#2666).

- `useLiveEntity` called `reload` again for changes arriving after its coalesce window even while the previous reload was still in flight, so two requests for the same record could run at once. Changes arriving meanwhile now cause exactly one more reload once it settles.
- `useEntityItemPage.load()` and the edit form's `load()` keep only their latest call: a superseded call writes no data, no error, and does not clear `loading`. On a detail page an older answer can no longer overwrite a newer one; on an edit form, moving quickly between records can no longer leave the previous record's data in the form.
