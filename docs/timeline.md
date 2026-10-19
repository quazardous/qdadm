# EntityTimeline: one entity's history across actors

`EntityTimeline` follows one entity through everything that happened to it.
For an order, that means injected by the marketplace, imported by the shop,
sent to the supplier, labelled by the carrier, refunded. For a box, it means
created, loaded, refreshed, destroyed. Each event belongs to an **actor**,
shown by a colour and an icon.

```vue
<EntityTimeline
  :source="{ entity: 'order_events', filters: { order_id: order.id } }"
  :actors="{
    marketplace: { label: 'Marketplace', color: '#7c3aed', icon: 'pi pi-shopping-bag' },
    shop: { label: 'Shop', color: '#2563eb', icon: 'pi pi-shop' },
    carrier: { label: 'Carrier', color: '#16a34a', icon: 'pi pi-truck' },
  }"
  :gaps="[{ label: 'order → ready to ship', from: (e) => e.kind === 'imported', to: (e) => e.kind === 'ready' }]"
  query-key="actors_off"
>
  <template #detail="{ event }">
    <JsonViewer :model-value="event.payload" />
  </template>
</EntityTimeline>
```

## Events

Pass them as `events` (an array), or as `source` to read an events entity
through its manager. `source` reads `{ filters, page_size: limit }`, where
`limit` defaults to 500.

By default an event is read as `{ id, at | created_at | timestamp, actor,
title | label | message, kind, severity }`. For another shape, pass `map`,
returning `{ id?, at, actor?, title, kind?, severity? }`:

```js
:map="(e) => ({ id: e.uuid, at: e.occurred_at, actor: e.source, title: e.summary })"
```

`severity` (`success`, `info`, `warn`, `danger`) colours the title.

## What it shows

- One column ordered by time, with a separator per day. A toolbar button
  flips it between oldest first (the `order` default, `asc`) and newest
  first.
- Each event shows its time of day and a relative time ("2 hours ago"); the
  full date sits in the tooltip and in the expanded detail.
- **Actors**: one chip per actor present; clicking a chip hides that actor's
  events. With `query-key`, the hidden actors are kept in the URL, so a link
  keeps the view.
- **Detail**: with a `#detail="{ event, item }"` slot, every event expands
  into it. Drop a payload viewer, an email preview or a link there. Without
  the slot, events are not clickable.
- **Gaps**: `gaps` set to `true` shows the time since the previous event
  (among the visible ones). A list of `{ label, from, to }` shows named
  durations above the timeline, from the first event matching `from` to the
  first one after it matching `to`; "—" until both have happened.

## Live

In `source` mode, the timeline rereads its events when the entity changes
elsewhere: the live entities route the change, and the entity's `live` policy
applies. New events flash for a moment; the first read does not. With
`height`, the timeline scrolls inside itself, and when new events land out of
view a button counts them and brings them into view.

In `events` mode, new items in the array flash the same way.

## Props

| Prop | Default | |
|---|---|---|
| `events` | — | the events, as an array |
| `source` | — | `{ entity, filters?, limit? }`, read through the manager and kept live |
| `map` | reads the usual field names | `(event) → { id?, at, actor?, title, kind?, severity? }` |
| `actors` | `{}` | `{ [key]: { label?, color?, icon? } }` |
| `order` | `asc` | initial order; the toolbar flips it |
| `gaps` | `false` | `true`, or a list of named durations |
| `query-key` | — | keep the actor filter in the URL under this key |
| `height` | — | scroll inside the timeline |

The demo has a page for it: Features → Timeline.
