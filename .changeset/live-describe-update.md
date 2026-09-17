---
"@quazardous/qdadm": minor
---

feat(live): an entity decides whether a live reload of a detail page is worth a notification entry, and what it says. `live.describeUpdate(before, after)` returns `null` for no entry (the badge still flashes) or the entry to add. Without it, the generic "… updated elsewhere" entry stays.
