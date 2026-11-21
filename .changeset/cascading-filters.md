---
'@quazardous/qdadm': minor
---

useListPage: cascading filters (#5427). `addFilter(name, { optionsEndpoint | optionsEntity, dependsOn })` reads the filter's choices again when one of the filters it depends on changes, with their values (`params` of the endpoint request, `filters` of the entity's list; a name list or a `{ filter: 'param' }` map). The old choices stay shown while loading (`_optionsLoading`), a late answer is ignored, and a value no longer offered is cleared the usual way (list reloaded, address and session updated, the cascade going on); `validate(value, { options, values })` decides instead whether it stands. The demo's books list has an author filter depending on the genre.
