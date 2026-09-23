---
"@quazardous/qdadm": minor
---

feat(live): an entity's live policy can differ per screen and per change kind. `live.refresh` accepts `{ list, show }`, each rule being `'mounted'`, `false` or the kinds that trigger a reload (`['created', 'deleted']`). A list can stop reloading on every update while detail pages keep following their record. An event a screen ignores neither reloads nor flashes the badge. The scalar form is unchanged.
