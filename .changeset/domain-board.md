---
'@quazardous/qdadm': minor
---

`QdDomainBoard`, a domain's board (#5352, lot 4 of #5337): the level between a dashboard and a list. The app declares typed blocks on a grid of 12 columns: `kpi` (a number, its note, its status as a side bar and a word), `breakdown` (bars scaled within each group, the value written), `top` (a small table with text, mono, tags, number and spark columns, each row opening its item, a "more" link) and `timeline` (one bar per day or hour, the latest outlined, the total and its change on the period before). Each block takes `data` or reads its own with `load()`, and draws its own loading, unreachable (with a retry), empty and invalid states, its data checked against the type's JSON Schema; the header gives the source, its freshness and a link. `registerBoardBlock()` adds a type of the app's own.
