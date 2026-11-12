---
'@quazardous/qdadm': minor
---

The active stack follows its records: an `entity:data-invalidate` for a record of the stack (its id, or the whole entity) reads it again, coalesced over the entity's `live.coalesceMs`, so `useChildPage`'s `parentData` and the breadcrumb update without a navigation. A read never overlaps another, a pending one is dropped when the stack moves on, and a failed one keeps what is shown (#4960).
