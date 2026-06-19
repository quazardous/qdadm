---
"@quazardous/qdadm": minor
---

Add `<ParentCard>` — a normalized parent detail cartouche for embedding at the top of a child `ListPage` (the "B2" hybrid composition, qdadm #1038).

On a child-list route, `useListPage` already resolves and exposes the parent record (`parentData` / `parentLoading`) with no extra fetch. `<ParentCard>` renders it read-only above the table, auto-deriving its fields from the parent entity's manager and using the **same** field resolver as `ShowPage`, so the cartouche looks exactly like a real detail page:

```vue
<template #beforeTable>
  <ParentCard :entity="'books'" :data="list.parentData.value" :loading="list.parentLoading.value" />
</template>
```

Pass `fields` to restrict/order the displayed fields, or use the default slot to render the parent yourself with the resolved field set. Works whether the child route comes from `ctx.crud(...,{foreignKey})` or `ctx.childPage()` — it only depends on `parentData`.

Internally, the show field-resolver (schema-type → display-type mapping, auto reference routes, severity badges) was extracted into a shared `createShowFieldResolver` used by both `useEntityItemShowPage` and `<ParentCard>` — no behavior change to existing show pages.
