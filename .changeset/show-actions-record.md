---
'@quazardous/qdadm': minor
---

useEntityItemShowPage: actions see the record (#5430). `visible(ctx)` and `disabled(ctx)` receive `{ data, canEdit, canDelete, loading }` (`data` the record shown, `null` while it loads); `label`, `icon` and `severity` accept a function of the record, read at each render. Backward compatible: the old signatures keep working. `ActionConfig<T>` and `ShowActionContext<T>` are typed by the page's record. crud.md gains "Actions on an item page" (placement, order, record-dependent gestures, external links, and why gestures belong in addAction rather than the #toolbar slot).
