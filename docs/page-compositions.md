# Page Compositions — what to use for which need

> **Where to start.** This guide maps a UI need → the qdadm composition to use.
> For the details of each building block (methods, slots, options), see [crud.md](./crud.md).
> For *how fields are rendered and edited* (the `FormInput` façade and the rich
> widget catalog), see [forms.md](./forms.md).

qdadm provides a few **canonical compositions**. Knowing the right one up front
avoids reaching for a hand-rolled `DataTable` where a compliant `ListPage` would do
(see [QDADM_CREDO](../packages/qdadm/QDADM_CREDO.md) — invisible storage + ListPage by default).

## Decision table

| I want to… | When | Composition | Building blocks | Detail |
|---|---|---|---|---|
| List an entity (CRUD) | A classic list page with filters/actions | **List page** | `useListPage` + `ListPage` (+ `addCreateAction`/`addEditAction`/`addDeleteAction`) | [crud.md#list-page](./crud.md#list-page) |
| Create / edit an entity | A single create+edit form | **Form page** | `useEntityItemFormPage` + `FormPage` (`#fields` required, `FieldGroups`, `addSaveAction`) | [crud.md#form-page](./crud.md#form-page) |
| Display an entity read-only | A read-only detail view | **Show page** | `useEntityItemShowPage` + `ShowPage` + `ShowField` | [crud.md#show-page](./crud.md#show-page) |
| List a **child** entity under a parent | Standalone child list (tab of the parent detail) | **Child list (tab)** | `useListPage` + `ListPage` + `PageNav`, declared via `ctx.crud(child, {list}, {parentRoute, foreignKey})` | [crud.md#child-entity-list](./crud.md#child-entity-list) |
| **Parent detail + its child list together** | See [Hybrid compositions](#hybrid-compositions) | **Hybrid A / B2 / B1** | depends on the case | below |
| Custom (non-entity) tab on a detail view | A free block attached to a parent | **Child page** | `useChildPage` + `PageLayout`, via `ctx.childPage(parent, name, opts)` | [crud.md#child-page-non-entity](./crud.md#child-page-non-entity) |
| Form with tabs / custom blocks | A rich layout inside a form | **Form + groups** | `FormPage` `#fields` slot + `FieldGroups` (`layout: 'tabs'`/`'accordion'`) | [crud.md#fieldgroups-layouts](./crud.md#fieldgroups-layouts) |
| Dashboard / report / viewer | Not a CRUD entity | **Custom (off-credo)** | `PageLayout` + hand-rolled `DataTable`/`Card`, via `ctx.routes()` | [crud.md#ctxroutes](./crud.md#ctxroutes) |
| Custom action (row or header) | Open a dialog, trigger a command… | — | `addAction` / `addHeaderAction` (free `onClick`, not necessarily routing) | [crud.md#builder-methods](./crud.md#builder-methods) |

---

## Base compositions

The four canonical pages all follow the same wiring:
**builder → configure → bind** (`v-bind="x.props.value" v-on="x.events"`). Full examples in [crud.md](./crud.md).

- **List page** — `useListPage({ entity })`, columns via the `#columns` slot, filters via `addFilter`, actions via `add*Action`.
- **Form page** — `useEntityItemFormPage({ entity })`. ⚠️ `FormPage` does not render the fields on its own: the `#fields` slot is **required**. Create/edit mode is auto-detected from the route.
- **Show page** — `useEntityItemShowPage({ entity })`, fields via the `#fields` slot + `ShowField`.
- **Child list (tab)** — a `ListPage` mounted under a parent: the FK filter is **auto-applied** from `route.meta.parent`, no config in the composable.

---

## Hybrid compositions

"Parent detail + its child list on the same view" comes in **three** forms.
The deciding factor is *who hosts whom*.

### A — Tabs (`PageNav`) · *large standalone child list*

Parent detail (`ShowPage`) + child list on its **own child route**, presented as
side-by-side tabs via `PageNav`. The parent filter is **automatic** (the child route
carries the `parentId` → `route.meta.parent`).

- Declaration: `ctx.crud(child, { list }, { parentRoute, foreignKey, label })`.
- Use when: the child list is large / needs its own filters, pagination, URL.
  This is the default, zero glue.
- Detail: [crud.md#child-entity-list](./crud.md#child-entity-list).

### B2 — Child list as host + embedded parent card · *recommended*

This is **the** answer to "a list embedded in a detail page". The page **is** the
child list (route `/parent/:id/children`); the **parent detail is shown at the top**.

Why it's clean: on this route, `useListPage` already does all the work —

- the **FK filter is auto-injected** from `route.params` (the list is already scoped to the parent);
- the composable **already instantiates and exposes the parent**: `parentData`, `parentId`,
  `parentLoading`, `parentChain`, `parentPage`. **No extra fetch.**

All that's left is to *render* `parentData` in the `#beforeTable` slot. The
**`<ParentCard>`** component does this in one line: it automatically derives the fields from
the parent's manager and renders them with the **same renderers as `ShowPage`** (visual
consistency with real detail views, zero re-fetch).

```vue
<script setup>
import { useListPage, ListPage, ParentCard, PageNav } from '@quazardous/qdadm'
import Column from 'primevue/column'

// Child route /books/:bookId/loans → parent (book) already resolved by useListPage
const list = useListPage({ entity: 'loans' })
list.addCreateAction('New Loan')
list.addEditAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav><PageNav /></template>

    <!-- Normalized parent card, fed by parentData (zero re-fetch) -->
    <template #beforeTable>
      <ParentCard
        :entity="'books'"
        :data="list.parentData.value"
        :loading="list.parentLoading.value"
        :fields="['title', 'author']"
      />
    </template>

    <template #columns>
      <Column field="borrower_name" header="Borrower" sortable />
      <Column field="borrowed_at" header="Borrowed" sortable />
    </template>
  </ListPage>
</template>
```

`fields` is optional (omitted → all of the manager's fields); `<ParentCard>`'s default slot
lets you render the parent yourself from the resolved field set.

> **Works via `crud` *or* `childPage`.** The parent card only depends on
> `route.meta.parent` being set — so it works whether the child route comes from
> `ctx.crud(child, {list}, {parentRoute, foreignKey})` or from `ctx.childPage(parent, name)`.
> Only the **list scoping** differs: with `foreignKey`, `useListPage` arms a query FK filter
> (`useListPage.ts:944`); without `foreignKey` (the `childPage` case), `parentData` /
> `parentChain` are still populated and scoping goes through `parentChain` + `resolveStorage`
> (nested endpoint). In both cases the card is identical. *(Validated on a real skybot case —
> `childPage` without `foreignKey`.)*

- Use when: the child list reads "along with the detail" and you want the parent context
  visible at all times.

### B1 — Parent show as host + inline child list · *escape hatch*

The reverse: the page **is** the parent detail (`ShowPage`) and you embed a child
`ListPage` in a slot (`#footer` or a custom section), **without** a tab or a child route.

⚠️ Honest gotcha: on the *parent show* route, `route.meta.parent` does not point to a
child relation → **the FK filter is not auto-wired**. You must inject it by hand:

```js
const children = useListPage({
  entity: 'loans',
  syncUrlParams: false,    // avoid fighting the host page over the URL
  persistFilters: false,
  onBeforeLoad: (params) => ({ ...params, book_id: route.params.bookId }),
})
```

- Use when: a small contextual list (e.g. "last 5 loans") inside a detail view, where going
  through a child route would be overkill.
- Otherwise, prefer **A** (standalone list) or **B2** (host list + embedded parent).

### Choosing between A / B2 / B1

| Situation | Composition |
|---|---|
| Large child list, own filters/pagination/URL | **A (tabs)** |
| "List inside a detail view", parent visible at the top | **B2** (recommended) |
| Small contextual list along a parent detail | **B1** (escape hatch) |

---

## Custom / off-credo

For a dashboard, a report, a viewer — anything that is not a CRUD entity — a hand-rolled
`DataTable`/`Card` mounted in a `ctx.routes()` route is legitimate. The "ListPage by
default" credo targets entity lists, not aggregation views.
