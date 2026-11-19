# Card dashboards

A dashboard is a zone whose blocks are cards. The same blocks render in a
classic `Zone` (in weight order, as declared) or in `CardsDashboard`, where each
user reorders them, hides them and pins them at the top. A card is written
once, with no knowledge of where it will be shown.

```js
// In a module's connect(ctx)
ctx.zone('home-cards')
ctx.block('home-cards', { id: 'sales', component: SalesCard, weight: 10, props: { title: 'Sales' },
                          card: { required: true, span: 2 } })
ctx.block('home-cards', { id: 'orders', component: OrdersCard, weight: 20, props: { title: 'Orders' } })
ctx.block('home-cards', { id: 'news', component: NewsCard, weight: 30, card: { title: 'News', fixed: true } })
```

```vue
<Zone name="home-cards" />                       <!-- classic: as declared -->
<CardsDashboard zone="home-cards" id="home" />   <!-- arranged by each user -->
```

`DashboardLayout customizable` renders its `widgets` zone (`DASHBOARD_ZONES.WIDGETS`) with `CardsDashboard`.

## Ready-made cards

qdadm draws the cards themselves: an envelope shared by all, and card types
that draw a shape of data (a value, a target, a queue…). They have no
business in them; the app gives the data. Each type answers one question,
and the [bestiary](cards.md), generated from the sheets, says which.

```vue
<QdCardView
  type="metric"
  :envelope="{ title: 'Orders to process', status: 'critical', source: 'shop', freshness: readAt,
               to: { name: 'orders' }, action: { verb: 'Process the 1st', mode: 'next', to: firstOrder } }"
  :data="{ value: 14, label: 'orders', delta: { value: 4, period: 'week' }, series, hot }"
  :options="{ higherIs: 'worse' }"
/>
```

**The envelope** (`QdCard`) has two zones, one gesture each. The surface (the
title's link, stretched over the card) opens the domain's board; the action
button does the main gesture, `mode: 'next'` for the most urgent item or
`'list'` for the filtered list: `to` opens a route, `run` walks the items
behind the card one after the other with the [run bar](crud.md#a-run-one-item-after-the-other),
`onClick` does a gesture of the app's own. A link or a button inside the body
stops there.
The status is a side bar, a hue and a word, never the hue alone. `state`
draws `loading`, `unreachable` (with `error`) or `empty` (with `emptyText`)
instead of the body. `size` is `s`, `m` or `l`: 1, 2 or 3 columns.

**The data is checked** against the type's JSON Schema before the body draws:
what does not fit draws the `invalid` state with the path and the reason, and
the rest of the board keeps working. Options are declared in the sheet, with
their defaults; a card is set by its options, not by CSS.

The generic cards: `metric`, `queue`, `goal`, `bullet`.

### A card type of your own

A card type is a folder: `meta.json` (its sheet: question, readings,
strengths, when to avoid it, sizes, options, typical action, a full example),
`schema.json` (the JSON Schema of its data) and its body, a component taking
`data`, `options` and `size`.

```js
import { registerCard } from '@quazardous/qdadm'
import Body from './cards/stock/StockCard.vue'
import meta from './cards/stock/meta.json'
import schema from './cards/stock/schema.json'

registerCard({ type: 'stock', component: Body, meta, schema })
```

The tooling reads the same folders:

```sh
qdadm-cards index src/cards --index src/cards/cards-index.json --bestiary docs/cards.md
qdadm-cards check src/cards --index src/cards/cards-index.json --bestiary docs/cards.md
```

`index` writes the index (every sheet and schema, as JSON) and the bestiary.
`check` fails on a card without a sheet or a schema, an example that does not
fit its own schema, or an index or a bestiary out of date. In a test:

```js
import { checkCards } from '@quazardous/qdadm/cards/tools'
expect(checkCards('src/cards', { index: 'src/cards/cards-index.json', bestiary: 'docs/cards.md' })).toEqual([])
```

### The gallery

`<QdCardsGallery />` shows every registered card, qdadm's and the app's, in
each of its sizes and states, light and dark, from its sheet's example. Mount
it on a route: it is the reference for the look. Each tile carries
`data-gallery-card`, `-state`, `-size` and, on its theme block,
`data-gallery-theme`, so a script can capture them one by one. The demo does
it at `/cards`, and `npm run cards:shots` in `packages/demo` writes one PNG
per tile in `shots/cards/`.

## A domain's board

`QdDomainBoard` is the level between a dashboard and a list: what a card's
surface opens. The app declares typed blocks on a grid of 12 columns; the
component knows only the types.

```vue
<QdDomainBoard
  :source="{ label: 'LegacyLog', freshness: readAt, to: 'https://logs.example' }"
  :blocks="[
    { type: 'kpi', data: { label: 'Open', value: 69, note: 'signatures not handled' } },
    { type: 'kpi', data: { label: 'Fatal', value: 0, status: 'good', note: 'no broken page' } },
    { type: 'breakdown', title: 'By kind', load: () => errors.byKind() },
    { type: 'top', title: 'Most frequent', load: () => errors.top(5), more: { label: 'All 69', to: { name: 'php-error' } } },
    { type: 'timeline', title: 'Per day', load: () => errors.perDay(14) },
  ]" />
```

- **The header:** the source, how fresh it is, and a link to it (an outside
  address opens in a new tab). The breadcrumb stays the app's.
- **The grid:** each block has a `span` of 12 (default: kpi 3, breakdown 5,
  top 7, timeline 12). Narrower, the figures go two by two and the rest one
  per row.
- **The data:** `data`, or `load()`, read like `useAsyncRead`. Each block
  draws its own states: loading, unreachable (with its reason and "Try
  again"), empty (`emptyText`), and invalid when the data does not fit the
  type's JSON Schema (with the path and the reason). One slow source never
  holds the board.
- `more: { label, to }` adds the link to the full list under a block.

| Type | Data | Draws |
|---|---|---|
| `kpi` | `{ label, value, unit?, decimals?, note?, status?, to? }` | The number, its note, its status as a side bar and a word |
| `breakdown` | `{ groups: [{ title?, rows: [{ label, value, to? }] }], note? }` | A bar per line, scaled within its group, the value written |
| `top` | `{ columns: [{ key, label, type? }], rows: [{ values, to? }] }` | A small table; `type` is `text`, `mono`, `tags` (`[{ label, status }]`), `number` or `spark` (a list of numbers); a row's first cell opens it |
| `timeline` | `{ points: [{ at, value }], bucket?, label?, previous?, higherIs? }` | One bar per day (or hour), the latest outlined; the total and its change on the period before |

`registerBoardBlock(type, { component, schema, span, isEmpty? })` adds a type
of the app's own: the component gets the block's `data`.

## Arranged cards

- Any block with an `id` is a card: the id is its key in the saved arrangement.
  A block without one is shown after the cards, and cannot be arranged.
- `card` is optional, and a classic `Zone` ignores it. Its fields:

| Field | Effect |
|---|---|
| `title` | Names the card in edit mode, the hidden tray and announcements (an i18n key works). Default: the block's `title` prop, else its id. |
| `required` | Always shown: no hide button. |
| `fixed` | Keeps its default place: no handle, no pin. The other cards flow around it. |
| `pinned` | Pinned at the top by default; the user can unpin it. |
| `span` | Columns the card spans, 1 to 3. On a narrow grid every card takes one column. |
| `sizes` | The sizes the user may pick: `s`, `m`, `l` are 1, 2, 3 columns. Default all; `span` stays the default size. |
| `description` | What it shows, in the catalogue (an i18n key works). |
| `repeatable` | Added from the catalogue, as many times as wanted, each with its own parameters (below). The block itself is not shown, nor by a classic `Zone`. |
| `params` | A repeatable card's parameters: a JSON Schema in the cards' subset (`type`, `enum`, `required`, `minimum`…), with a `title` and a `description` per property. `enumLabels` gives a choice's words, keyed by value. |

### A card with parameters

A repeatable block is a model: each person adds it from the catalogue with
its parameters, which arrive as its props, merged into the block's own.

```js
ctx.block('ops-dashboard', {
  id: 'saved-search',
  component: SavedSearchCard,          // props: genre, maxItems
  card: {
    title: 'Saved search',
    description: 'The books of one genre, to review one after the other',
    repeatable: true,
    params: {
      type: 'object',
      required: ['genre'],
      properties: {
        genre: { type: 'string', title: 'Genre', enum: ['fantasy', 'sci-fi'], enumLabels: { 'sci-fi': 'Sci-fi' } },
        maxItems: { type: 'integer', title: 'Lines', minimum: 1, description: 'How many books it lists' },
      },
    },
  },
})
```

The catalogue's form has one field per property: a choice for an `enum`, a
number for `number` / `integer`, yes / no for `boolean`, text otherwise. The
values are checked against the schema before the card is added. Each instance
has its own id, title, size, section and place, and is hidden or removed on its
own.

## `CardsDashboard`

| Prop | Default | |
|---|---|---|
| `zone` | `DASHBOARD_ZONES.WIDGETS` | The zone whose blocks are the cards |
| `id` | the zone's name | The dashboard's name in the storage key |
| `minCardWidth` | `18rem` | The narrowest a card gets before the grid drops a column |
| `editable` | `true` | Show the "Customise" button |
| `hiddenView` | `'cards'` | How the tray shows hidden cards by default: `'cards'` (whole) or `'compact'` (chips) |
| `storage` | `configureDashboards`'s, else `localStorage` | Where the arrangement is kept (see below) |
| `loadGrace` | `150` | Ms an async load may take before the default order shows |

"Customise" opens edit mode: a bar on each card with a handle, its size, its
section, pin and hide (and remove, for an added card), then the tray of hidden
cards, "Reset" and "Done". Outside edit mode only the cards show.

- **"Add a card"** opens the catalogue: the repeatable cards, each with its
  description (and its question, for a [ready-made card](cards.md)), and the
  hidden cards, which come back where they were.
- **The size:** a choice on the card's bar, among its `sizes`.
- **"Add a section"** groups the cards under names: the first time, it makes
  "Main", holding every card, and a new section to name. A section's name is
  edited in place; removing a section sends its cards to the first one. A card
  goes to another section with the choice on its bar, and moves within its
  section. Pinned cards stay on top, above the sections. With no section, the
  board is one group.

The tray shows the hidden cards whole, dimmed and inert, in the same grid; or,
with its Cards / Compact switch, as one chip each. "Show" restores a card in its
old place. The user's choice of view is kept beside the arrangement
(`qdadm.dashboard.<id>.<user>.tray`); `hiddenView` sets it until they choose.

Moving a card:

- **Keyboard:** on the focused handle, the arrow keys move the card one place,
  Home and End to the start or the end of its group. Focus stays on the card,
  and a live region announces "Sales: card 3 of 8".
- **Drag:** the handle, with a mouse, a finger or a pen (pointer events, no
  dependency). Escape cancels the drag.
- Pinned cards and the others are two groups: a card moves within its group,
  and pinning moves it to the other.

## Favourites and recents

What a person follows, and the records they just opened. They live in two
entities the app declares, `favorites` and `recents`, and qdadm reads and
writes them through their managers: their storage decides where they are
kept and whose they are (a server answers the current user's).

```js
ctx.entity('favorites', {
  labelField: 'label',
  fields: { label: {}, kind: {}, entity: {}, to: {}, at: { type: 'datetime' } },
  storage: new ApiStorage({ endpoint: '/me/favorites' }),
})
ctx.entity('recents', {
  labelField: 'label',
  fields: { label: {}, entity: {}, itemId: {}, to: {}, at: { type: 'datetime' } },
  storage: new ApiStorage({ endpoint: '/me/recents' }),
})
```

qdadm writes `{ kind, label, to, entity, at }` in a favourite (`kind` is
`item`, `list`, `search` or `board`, `to` the page's path) and
`{ entity, itemId, label, to, at }` in a recent; `at` is an ISO date. A field
the app adds is kept. The person needs the grants to create and delete them
(`entity:favorites:*`, `entity:recents:*`).

`configureFavorites({ favorites: 'stars', recents: 'seen' })` names other
entities; `false` turns one off. Without its entity, the star and "Save this
search" do not show, nothing is recorded, and the cards say so (a console
warning in development says what to declare).

- **The star** beside a page title adds the page to the favourites, or
  removes it. `ListPage`, `ShowPage` and `FormPage` (in edit mode) draw it;
  `:favorite="false"` turns it off. A page of the app's own puts
  `<QdFavoriteStar :label="title" kind="board" />` where it wants. The star is
  `aria-pressed` and says "Add Dune to favourites" / "Remove …".
- **"Save this search"** shows on a list while a filter or a search is on. It
  asks for a name, by default the filter in words, and keeps the list's URL
  with its query: the favourite opens the list filtered again.
- **Recents:** the show and edit pages record the record they open, the last
  one first, at most 20 (the older ones are deleted). Deleting a record takes
  it out of the recents and the favourites.
- **The cards:** `QdFavoritesCard` (by kind: records, lists, searches,
  boards) and `QdRecentCard` (with when) show them live, and read them again
  when they appear; put them on a dashboard as blocks. They draw the
  [card types](cards.md) `favorites` and `recent`.

```js
import { QdFavoritesCard, QdRecentCard } from '@quazardous/qdadm'

ctx.block(DASHBOARD_ZONES.WIDGETS, { id: 'favorites', component: QdFavoritesCard, card: { title: 'Favourites', pinned: true } })
ctx.block(DASHBOARD_ZONES.WIDGETS, { id: 'recent', component: QdRecentCard, card: { title: 'Recent' } })
```

`useFavorites()` gives `available`, `list`, `has(to)`, `find(to)`, `add`,
`remove`, `toggle`, `rename`, `forgetPath` and `reload`; `useRecent()` gives
`available`, `list`, `record`, `forget` and `reload`. Both are shared by every
component of the tab; a write that fails leaves the list as it was.

## Saved arrangement

Each user's arrangement is kept under the key `qdadm.dashboard.<id>.<user>`
(the auth user's id or username, else `anonymous`) as
`{ v: 2, order, hidden, pinned, sizes, sections, sectionOf, instances }`,
in `localStorage` by default. A `v: 1` arrangement migrates as it is. Without storage
(private window, blocked) the arrangement lasts the page.

It is saved once, when the edit ends: "Done" saves it if anything changed,
"Reset" clears it. Leaving the page in the middle of an edit saves it too.

### Storage

To keep it with the account, on the server, give a storage: once for the app,
or per dashboard with the `storage` prop.

```js
import { configureDashboards } from '@quazardous/qdadm'

configureDashboards({
  storage: {
    load: (key) => api.get(`/me/dashboards/${key}`).then((r) => r.data, () => null),
    save: (key, arrangement) =>
      arrangement ? api.put(`/me/dashboards/${key}`, arrangement) : api.delete(`/me/dashboards/${key}`),
  },
})
```

- `load(key)` returns the arrangement, `null`, or a promise of either.
  Whatever it gives back is reconciled (below), so the server may store it as
  an opaque JSON blob.
- `save(key, arrangement)` gets `null` on "Reset": back to the defaults.
- While an async load runs, the cards are held back for `loadGrace` ms. An answer
  within it shows straight away; a later one replaces the default order when it
  lands. An answer that comes after the user started arranging is not applied.
  A failed load keeps the defaults, with a console warning.
- A failed save shows a toast, keeps the arrangement as shown and the edit open;
  "Done" tries again.
- The tray's Cards / Compact choice stays in `localStorage`: it belongs to the
  browser, not to the arrangement.
- `localArrangementStorage` is the default storage, to wrap or fall back on.

On every load it is reconciled with the declared cards:

- a card the app removed is dropped;
- a new card takes its default place, after its neighbour in the default order;
- a `required` card is never hidden, a `fixed` card is back at its default place;
- an added card whose block is gone, or whose parameters no longer fit its
  schema, is dropped (with a console warning); a size the card no longer
  allows is dropped;
- an unknown version starts from the default.

`useCardsArrangement(storageKey, cards, { storage, autoSave, loadGrace })` is
the same logic without the UI (it saves at each change unless
`autoSave: false`, then on `commit()` and `reset()`), and
`reconcileArrangement()` the reconciliation alone. It also gives `add`,
`remove`, `resize`, `addSection`, `renameSection`, `removeSection` and
`moveToSection`, and the pure functions behind them are exported
(`addInstance`, `setSize`, `setSection`…).
