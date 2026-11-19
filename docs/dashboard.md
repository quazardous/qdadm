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
`'list'` for the filtered list. A link or a button inside the body stops there.
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

"Customise" opens edit mode: a bar on each card with a handle, pin and hide, then
the tray of hidden cards, "Reset" and "Done". Outside edit mode only the cards show.

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

## Saved arrangement

Each user's arrangement is kept under the key `qdadm.dashboard.<id>.<user>`
(the auth user's id or username, else `anonymous`) as
`{ v, order, hidden, pinned }`, in `localStorage` by default. Without storage
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
- an unknown version starts from the default.

`useCardsArrangement(storageKey, cards, { storage, autoSave, loadGrace })` is
the same logic without the UI (it saves at each change unless
`autoSave: false`, then on `commit()` and `reset()`), and
`reconcileArrangement()` the reconciliation alone.
