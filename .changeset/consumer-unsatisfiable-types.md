---
"@quazardous/qdadm": patch
---

Two types consumers could not satisfy without casts (#1281): `ctx.entity()` is now generic (`entity<T extends EntityRecord>`) so narrowed `EntityManager<T>` subclasses pass (the invariant `EntityManager<EntityRecord>` parameter rejected them); `ResolvedAction` has a single declaration — `ShowPage` imports the composable's type instead of redeclaring it, and `severity` is typed `ButtonSeverity` (now exported from the main barrel) across `ActionConfig`, `LazyActionConfig` and show badges, so `v-bind="show.props.value"` typechecks.
