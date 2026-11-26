# Card layouts

The shared base under the dashboards and a domain bar's indicators: a
catalogue of items, a **layout** that says which are shown, in which order,
with which parameters, and the building blocks to edit it. CardsDashboard is
built on it; an app builds its own editors with the same pieces (a page where
an admin lays out a domain's bar, for example).

## The catalogue and the layout

An **item** is `{ id, card: { title, description?, repeatable?, params?,
required?, fixed?, pinned?, … } }`: a dashboard's block, or a domain's
indicator (`domainLayoutItems(domain)`).

- A `repeatable` item is not shown itself: it is added, as many times as
  wanted, each time with its own parameters (`params`, a JSON Schema in the
  cards' subset, a `title` and `description` per property). Each added one is
  an **instance**, `<id>~<n>`.
- A **layout** is `{ v: 2, order, hidden, pinned, sizes, sections, sectionOf,
  instances }`. Every function reads any part it needs and leaves the rest:
  a bar's layout only uses `order`, `hidden` and `instances`.

## The core

Pure functions, no Vue:

| Function | |
|---|---|
| `reconcileLayout(saved, items, profile?)` | A saved layout, any shape or version, brought in line with the catalogue: unknown ids dropped, an instance whose parameters no longer fit dropped (with a warning), new items placed |
| `shownItems(layout, items, max?)` | The items shown, in order, at most `max` |
| `moveItem(layout, items, id, index)` | Move an item within its group |
| `setShown(layout, items, id, shown)` | Show or hide one (a `required` item stays) |
| `addInstance(layout, items, id, params, { title?, section? })` | Add a repeatable item; `{ layout, id }`, `id` null when the parameters do not fit |
| `setParams(layout, items, id, params, title?)` | An instance's parameters, kept only when they fit |
| `removeInstance(layout, id)` | An instance, gone |

They return the same object when nothing changes.

**Profiles** say what applies:

| Profile | |
|---|---|
| `DASHBOARD_PROFILE` (default) | A new item takes its default place, shown |
| `BAR_PROFILE` | A new item waits hidden, until someone shows it; at most 8 shown |

An app's own profile is a plain object: `{ newHidden?: boolean, max?: number }`.

## The building blocks

Each works on a layout it is given and says what changed; whoever holds the
layout saves it where it wants.

- **`QdLayoutOrder`** (`v-model` the layout, `items`, `max`): the shown items as
  a list. A handle moves each one, with the pointer or the keyboard (the
  arrows, Home, End; Escape cancels a drag); each is hidden, or removed when
  added; an added one's parameters are changed in place. The count is said
  against `max`; the ones past it are dimmed, « not shown ».
- **`QdLayoutCatalogue`** (`templates`, `hidden`, `sections`, `describe`):
  the items to add, each with « Add » opening its parameters, and the hidden
  ones, with « Show ». It emits `add(item, { params, title, section })` and
  `restore(item)`.
- **`CardParamsForm`** (`schema`, `title`, `initial`, `submitLabel`): an item's
  parameters, checked against its schema.
- **`useLayoutReorder(options)`**: the handle's moves on their own (the pointer
  and the keyboard), for a layout drawn another way. CardsDashboard's grid
  uses it.

## Example: a domain bar laid out by an admin

```vue
<script setup>
import { ref } from 'vue'
import {
  getDomain, domainLayoutItems, domainBarMax, reconcileDomainLayout,
  addInstance, setShown, reloadDomainBar,
  QdDomainBar, QdLayoutOrder, QdLayoutCatalogue,
} from '@quazardous/qdadm'

const domain = getDomain('library')
const items = domainLayoutItems(domain)
const layout = ref(reconcileDomainLayout(await api.get('/bars/library'), domain))
const add = (item, v) => (layout.value = addInstance(layout.value, items, item.id, v.params, { title: v.title }).arrangement)
const show = (item) => (layout.value = setShown(layout.value, items, item.id, true))
async function save() {
  await api.put('/bars/library', layout.value)
  reloadDomainBar('library')
}
</script>

<template>
  <QdDomainBar :key="JSON.stringify(layout)" :domain="domain" :layout="layout" />   <!-- the preview -->
  <QdLayoutOrder v-model="layout" :items="items" :max="domainBarMax(domain)" />
  <QdLayoutCatalogue
    :templates="items.filter((i) => i.card.repeatable)"
    :hidden="items.filter((i) => layout.hidden.includes(i.id))"
    @add="add" @restore="show"
  />
  <button @click="save">Save</button>
</template>
```

The bar reads it back through `features.domainBar.layout(domain)`
([dashboard.md](./dashboard.md#its-layout-from-the-app)). The demo's « Library
bar » settings page is this example
(`packages/demo/src/modules/books/pages/LibraryBarSettings.vue`).
