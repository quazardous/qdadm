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
instead of the body. The foot's **CTA zone** holds every gesture of the card
together: its `links` (`[{ label, icon, to | run | onClick }]`, "See all"),
the app's own buttons from the `#cta` slot (which gets `links`, `action`
and `state`), then the main `action`. A dashboard block adds links with
`card: { links }`. `size` is `s`, `m` or `l`: 1, 2 or 3 columns. `icon`
draws an icon class before the title: each type may have its own in its
sheet (a star for `favorites`, a clock for `recent`), the envelope changes it,
`null` hides it.

**The data is checked** against the type's JSON Schema before the body draws:
what does not fit draws the `invalid` state with the path and the reason, and
the rest of the board keeps working. Options are declared in the sheet, with
their defaults; a card is set by its options, not by CSS.

The generic cards: `metric`, `queue`, `goal`, `bullet`, `compare`, `trend`, `ranking`, `split`, `funnel`, `heat`, `agenda`, `feed`, and `favorites` and `recent` (below). The [bestiary](cards.md) says which question each answers.

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

### Charts

A chart (the `viz` block, the `metric`'s curve) draws as many series as it
is given, each `{ label, points, tone }`: in, out, errors… `chart` is `line`
(the default), `area` or `bars`; `stacked: true` stacks the series, areas
each on the one below or bars one on the other (`chart: 'stacked'` is
stacked bars). The range runs from the lowest value to the highest (bars
from zero), so a high, flat series still shows its moves. Every card draws
its charts this way: a `viz` block in a `blocks` card or under any card
(`envelope.blocks`, a dashboard block's `card.blocks`); a `trend` takes
`options.chart`; a `metric` takes `options: { chart, stacked }` and N series
in `data.series`, a sparkline at size `s`, and with several series at `m`
or `l` the full chart (time axis, legend, tooltip). Its domain bar pill
draws the same chart:

```js
{ id: 'traffic', card: 'metric', title: 'Traffic', load: readTraffic,   // { value, series: [{ label: 'in', points }, { label: 'out', points }] }
  options: { chart: 'area', stacked: true } }
```

**A chart of your own:** register a component under a name, and every
`chart: '<name>'` draws with it, in a `viz` block, a `metric` card and its
pill. qdadm keeps no charting library: wrap the one you like.

```js
import { registerChart } from '@quazardous/qdadm'
import EChartsSpark from './charts/EChartsSpark.vue'

registerChart('echarts', EChartsSpark)
```

It receives `series` (each point read: `{ t, v, low, high }`, `t` a
timestamp or null), `stacked`, `compact` and `height`, `unit` and
`decimals`, `warning`, `critical` and `normal`, `label`, `dot`, `colors`
(each series' colour as a CSS value, `var(--qd-cat-1)`, to read with
`getComputedStyle` when the library wants a colour) and `mode` (the domain
bar's mode in a bar, null elsewhere). qdadm's own names (`line`, `area`,
`bars`, `stacked`) are not taken; a name nobody registered draws a line,
with a warning in development.

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

## A domain's bar

A domain, declared once by its module, gets a bar on top of each of its pages,
at the top of the content area (the sidebar does not change): its title, its
navigation and its permanent indicators. It is a small dashboard: each
indicator is a card of a registered type, read from its own source, drawn as a
pill; a count shows as a badge, coloured when the card's status is `watch` or
`critical`, hidden at zero.

```js
// in the books module's connect(ctx)
ctx.domain('library', {
  label: 'Library', icon: 'pi pi-building-columns', to: { name: 'book-board' },
  entities: ['loans'],               // the loans pages join, though another module declares them
  nav: [
    { label: 'Board', route: 'book-board', icon: 'pi pi-th-large' },
    { label: 'Books', route: 'book', icon: 'pi pi-book', badge: 'toCheck' },  // the indicator's count
  ],
  indicators: [
    {
      id: 'toCheck', card: 'queue', title: 'To check', icon: 'pi pi-search',
      load: async () => ({ total: 5, items: [] }), refresh: 300,      // seconds
      status: (data) => (data.total ? 'critical' : null),
      to: { name: 'book-stats' },
    },
  ],
})
```

- **Its pages:** in this order, a route whose `meta.domain` names it
  (`meta.domain: false` keeps a page out of every domain), an address that
  says `?domain=<name>`, the pages of the entities it lists (`entities`), and
  the routes of the module that declares it. Then the app's resolver has the
  last word (below).
- **In the context stack:** the kernel resolves the page's domain at each
  route change and the active stack holds it, beside its entity levels:
  `useActiveStack().domain` (`{ type: 'domain', name, source }`, where
  `source` is `route`, `query` or `resolver`), and `context` for the domain
  followed by the entity levels, `[domain(it), tasks(12)]`. The bar and the
  breadcrumb read it from there; the breadcrumb shows the domain after Home,
  leading to its `to`.
- **The app's resolver:** `features: { domainResolver(route, ctx) { … } }` is
  called at each route change, after the default rule. `ctx.fallback` is what
  the rule found, `ctx.previous` the domain of the page we come from,
  `ctx.stack` the entity levels, `ctx.getDomain(name)` a declared domain.
  `ctx.record` is the record the page shows (its deepest stack level), once
  loaded, `null` before; `ctx.loading` says it is on its way, and the
  resolver is called again when it arrives (the breadcrumb's own read, no
  request of its own). It returns a domain's name, `null` for none, or
  `undefined` to keep `ctx.fallback`; while the record loads, `undefined`
  keeps the domain shown, so the bar does not blink. One that throws, or
  names a domain nobody declared, leaves the fallback, with a warning in
  development.

  ```js
  // A task's universe comes from its type; a list's from ?universe=
  domainResolver: (route, { record }) =>
    record?.type ? universeOfType(record.type)
      : typeof route.query.universe === 'string' ? route.query.universe : undefined,
  ```
- **Kept from page to page:** a page placed by `?domain=` hands its domain on to the pages of the same record chain (its list, its
  records, their edit pages, their children): the navigation gets
  `?domain=<name>`, so a reload or a shared link keeps it. One route per page
  is enough, with no route per domain. A side-menu click leaves the domain. A
  page whose own route places it, or that names a domain itself, is not
  touched; nor is a domain the resolver chose, which it decides again on each
  page. For an app's own link to elsewhere, `useDomainLink().withDomain(to)`
  adds the current domain, and `withDomain(to, name)` a given one.
- **Indicators:** `card` is a type with a pill form. `metric`, `queue` and
  `split` give a count (the badge); `goal` and `compare` give a value. A type
  of your own gets one with `registerCard({ …, pill: (data, options, locale, mode)
  => ({ value, count, blocks }) })`. Data that does not fit the type's schema, or a
  read that fails, marks the pill, with the reason in its title.
- **Shared sources:** several indicators showing parts of one answer name a
  source the domain declares (`sources`), read once for all of them, rather
  than each its own `load()`. See [Shared sources](#shared-sources).
- **Dynamic indicators:** `title`, `icon` and `to` take a value or a
  function of the indicator's data, read again at each read; `visible(data)`
  leaves a slot out, full or compact, once its data says so (while it loads,
  it is drawn as usual). The card reads only the fields its schema declares,
  so the data may carry more for these functions. A "top N" bar:

  ```js
  sources: { top: { load: () => api.get('/tasks/top'), refresh: 60 } },   // one read for the four slots
  indicators: [0, 1, 2, 3].map((i) => ({
    id: `top-${i}`, card: 'metric',
    source: 'top', value: (rows) => rows[i] ?? null,         // { value, series, label, link }
    title: (d) => d?.label, to: (d) => d?.link, visible: (d) => !!d,
  }))
  ```

  For an indicator's own `component`, `QdBadge`, `QdCardBlocks` and the
  blocks (`QdVizBlock`…) are exported, to draw it as qdadm does.
- **Full:** the bar extends downward. Under the title and the navigation,
  the indicators are a row of mini cards, at least three compact lines high:
  the title on top, the value large, a `metric`'s `series` as a sparkline
  across, the status as a side bar. The whole card leads to `to`. Their size:
  `--qd-domain-card-width`, `--qd-domain-card-min-height`,
  `--qd-domain-card-viz-height`; the space above their row,
  `--qd-domain-cards-gap` (0.5rem, the same in both looks).
- **Compact:** one line of icons and pills, on its own once the page scrolls
  (the bar stays on top), or by the toggle at its end, the choice kept per
  account. Compact on the scroll, a spacer under the bar
  (`.qd-domain-bar-reserve`) keeps the height it lost, so the page does not
  move and the bar does not flip back and forth; a compact chosen keeps none. An indicator shows its icon, its badge (or its value) and its
  sparkline, with no pill around it, a thin separator between two of them
  and after the navigation (`--qd-domain-pill-separator`); its title is in
  the tooltip and for screen readers. Short of room on the
  line, the sparklines go (`data-fit="tight"` on the bar) and come back once
  there is room again. Their size: `--qd-domain-pill-viz-width` and
  `--qd-domain-pill-viz-height`. Full or compact, the bar has no shadow;
  `--qd-domain-bar-shadow` and `--qd-domain-bar-compact-shadow` give it one.
- **Indicators and the bar's mode:** each indicator knows how the bar is
  drawn, `full` or `compact` (and why: `chosen` by the person, or
  `scrolled`), and says it in `data-mode`, for the app's CSS. A card's pill
  form receives it (`pill(data, options, locale, mode)`) and may return
  `blocks`, drawn across the mini card or in the pill. A `metric`'s
  sparkline is the card's own [chart](#charts) (a line by default, N
  series, `options: { chart, stacked }`); with several named series, the
  pill's tooltip gives each one's last value. `options: { spark:
  false }` takes it away, `compact: { options: { spark:
  false } }` only in compact. The app decides the rest, per indicator:

  ```js
  indicators: [
    // The app's own drawing of the card's or the pill's inside, given { data, options,
    // status, mode, title, icon, state, value, count }; `card` is optional
    { id: 'load', title: 'Load', load: readLoad, component: LoadPill },
    // When the bar is compact: options merged over `options`, another component
    { id: 'open', card: 'metric', title: 'Open', load: readOpen,
      compact: { options: { unit: '' }, component: OpenDot } },
  ]
  ```

  With a `card` beside the `component`, the card still checks the data and
  gives the nav entries their badge.
- **Its look:** `toolbox` (the default), one low line glued to the top edge
  of the content, full width, a rule at the bottom, drawn like the side menu:
  its font and icon sizes, its item height, square entries, the current one
  tinted and underlined by the accent. Or `card`, a card above the page. Per
  domain, `ctx.domain('purchases', { look: 'card', … })`, or for every
  domain, `features: { domainBar: { look: 'card' } }` in the kernel's
  options. Both are drawn from CSS custom properties, to change in the app's
  CSS: `--qd-domain-bar-bg`, `-border`, `-margin`, `-padding`, `-radius`,
  `-shadow`, `-height`, and for the toolbox `--qd-toolbox-entry-ink`,
  `--qd-toolbox-entry-hover-bg`, `--qd-toolbox-current-bg`,
  `--qd-toolbox-current-ink`, `--qd-toolbox-accent`. Set them on
  `.qd-domain-bar--toolbox`, or on one domain's bar:
  `.qd-domain-bar[data-domain='purchases']`.
- **Your own bar:** a block in the `_app:domain-bar` zone replaces it; it
  receives `domain`. `QdDomainBar` and `QdBadge` are exported.

### Shared sources

A **source** is a named read that a domain's indicators share: one load, one
state (loading, error, last good answer), whatever the number of indicators
that read it. It answers a common case: two pills, "To process" and
"Overdue", both computed from the same `/tasks/counts` answer. Each with its
own `load()`, every refresh sends the same request twice.

```js
ctx.domain('universe.it', {
  label: 'IT',
  sources: {
    counts: {
      load: () => api.get('/tasks/counts', { params: { universe: 'it' } }),
      refresh: 60,           // seconds; read again while one indicator reads it
      entities: ['tasks'],   // what it is derived from: a change reads it again
    },
  },
  indicators: [
    { id: 'todo', card: 'metric', title: 'To process', source: 'counts', value: (c) => ({ value: sum(c, 'count') }) },
    { id: 'late', card: 'metric', title: 'Overdue', source: 'counts', value: (c) => ({ value: sum(c, 'overdue') }),
      status: (d) => (d.value ? 'critical' : null) },
  ],
})
```

**Declaring it.** `sources` maps a name to `{ load, refresh?, entities? }`.
`load()` returns the answer, or a promise of it. It is called by the bar, never
by a page.

**Reading it.** An indicator names it with `source`. It takes its part with
`value(data)`, which gets the whole answer and returns what the card type
takes; without `value`, it gets the whole answer. From there, the indicator is
like any other: the card checks its part, and `status`, `title`, `icon`, `to`
and `visible` are functions of that part. An indicator with a `source` has no
`load()` of its own. If it names both, the source is read, with a warning in
development.

**Its life:**

- **One read for all.** Whatever the number of indicators, a source has one
  read in flight. A call made while a read is in flight waits for that read.
- **Refresh.** With `refresh`, it is read again every `refresh` seconds while
  at least one indicator reads it. With no reader left (the bar is gone), it
  stops.
- **Kept while fresh.** The answer outlives the bar. A bar that comes back
  within `refresh` (the same domain again, after a visit to another) shows it
  at once and reads nothing. Past `refresh`, or without one, it reads again.
- **Its error is theirs.** A first read that fails marks every indicator
  reading the source as unreachable, with the reason in its title. A later
  failure keeps the last good answer shown, as an indicator's own `load()`
  does.
- **A broken part stays local.** A `value()` that throws marks its own
  indicator as invalid, and the others stay as they are.
- **An unknown name.** An indicator naming a source the domain does not
  declare is marked invalid, and `ctx.domain()` warns about it in development.

**Source or entity.** They are not the same thing, and the difference is
what decides where the data belongs:

| | Entity | Source |
|---|---|---|
| What it holds | records, each with an id | an answer: a count, a curve, a summary |
| What it offers | CRUD, permissions, routes, pages, a list cache per query | one read, shared, refreshed |
| Kept fresh by | its own writes, the live stream, `invalidate()` | its `refresh`, and the changes to the entities it names |
| Declared by | `ctx.entity()` | the domain, under `sources` |

A count of tasks is not a record of anything. It has no id, no form and no
page. Declared as an entity, it would get a paginated `list()` it does not
have, and it would be refreshed by its own changes, which never happen,
rather than by those of the tasks it counts. So a source is derived from
entities and **names them** (`entities`). A change to one of them reads it
again: a write in the app, an event from the live stream ([live
entities](./live-entities.md)), or an app's `invalidate()`. Several changes
in a row cause one read, once they settle (300 ms). Closing a task updates
both pills at once, without waiting for the next refresh.

**Which one to use:**

- one indicator, its own data: its own `load()`;
- several indicators reading parts of one answer: a source;
- records people list, open and edit: an entity. An indicator can still read
  it, through a source or a `load()` that calls the entity's manager, and
  name it in `entities` to follow its changes.

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
| `rows` | Rows it spans, 1 or 2 (default 1). |
| `sizes` | The sizes the user may pick, width × height: `'1x1'` to `'3x2'`; `s`, `m`, `l` say `1x1`, `2x1`, `3x1`. Default all six; `span` × `rows` stays the default size. |
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
- **The size:** a button on the card's bar shows it (« 2 × 1 ») and opens a
  3 × 2 grid. Hovering or dragging from its top-left corner lights the
  rectangle; a click or a release picks it. The sizes the card does not allow
  are greyed out. From the keyboard: the focus on the current size, the arrows
  move, Enter picks, Escape closes. The change is announced.
- **Two rows high:** the card spans two rows of the grid, at least two row
  units (`--qd-card-row`, 10rem); a one-row card keeps its own height. On a
  narrow grid it takes one column and one row like the others. Its body reads
  the slot's size with `useCardSlotSize()` (`{ w, h }`, null outside a
  dashboard) to show more: the demo's saved search lists twice the lines.
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

- **The bookmark** beside a page title adds the page to the favourites, or
  removes it. `ListPage`, `ShowPage` and `FormPage` (in edit mode) draw it;
  `:favorite="false"` turns it off. A page of the app's own puts
  `<QdFavoriteStar :label="title" kind="board" />` where it wants. It is
  `aria-pressed`, filled once a favourite, and says "Add Dune to favourites"
  / "Remove …" in its aria-label and tooltip.
- **A search's bookmark** shows in a list's filter zone, beside the button
  that clears the filters, while a filter or a search is on. It asks for a
  name, by default the filter in words, in a popover anchored to it that
  stays in the window (Enter saves, Escape or a click outside closes, the
  focus comes back to the bookmark), and keeps the list's URL with its
  query: the favourite opens the list filtered again. Filled once saved; a
  click then takes the search out of the favourites.
- **The look is the app's** (`features.favorites` in the kernel's options):

  ```js
  features: {
    favorites: {
      icon: 'pi pi-bookmark',            // the symbol: page, search, the card's header
      iconActive: 'pi pi-bookmark-fill', // once a favourite
      saveSearch: 'filters',             // the search's bookmark: 'filters' | 'header' | false
      labels: false,                     // the text beside the icons
    },
  }
  ```

  Each use may say otherwise: `QdFavoriteStar` and `QdSaveSearch` take
  `icon`, `iconOn` and `labelled`; `ListPage` takes `save-search`;
  `QdFavoritesCard` takes `icon`.
- **Recents:** the show and edit pages record the record they open, the last
  one first, at most 20 (the older ones are deleted). Deleting a record takes
  it out of the recents and the favourites.
- **The cards:** `QdFavoritesCard` (by kind: records, lists, searches,
  boards) and `QdRecentCard` (with when) show them live, and read them again
  when they appear; put them on a dashboard as blocks. They draw the
  [card types](cards.md) `favorites` and `recent`.
- **"See all":** `moreTo` (a route to the app's full list) puts a "See
  all (12)" link in the card's foot once there are more lines than
  `maxItems`; `more="always"` shows it every time. The Favourites card then
  drops its "+N" line.
- **Removing from the card:** a × beside each favourite, on hover and focus
  (always on a touch screen), removes it at once. The line stays a few
  seconds where it was, saying so, with an Undo that adds it back.
  `:removable="false"` turns it off. Renaming and ordering are the app's to
  offer, if it wants them: `useFavorites().rename(id, label)`.

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
  allows is dropped; a size saved by its old name (`s`, `m`, `l`) is read as
  `1x1`, `2x1`, `3x1`, and saved by that name from then on;
- an unknown version starts from the default.

`useCardsArrangement(storageKey, cards, { storage, autoSave, loadGrace })` is
the same logic without the UI (it saves at each change unless
`autoSave: false`, then on `commit()` and `reset()`), and
`reconcileArrangement()` the reconciliation alone. It also gives `add`,
`remove`, `resize`, `addSection`, `renameSection`, `removeSection` and
`moveToSection`, and the pure functions behind them are exported
(`addInstance`, `setSize`, `setSection`…).
