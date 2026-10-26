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

## Cards

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

"Customise" opens edit mode: a bar on each card with a handle, pin and hide, then
the tray of hidden cards (a chip restores one in its old place), "Reset" and
"Done". Outside edit mode only the cards show.

Moving a card:

- **Keyboard:** on the focused handle, the arrow keys move the card one place,
  Home and End to the start or the end of its group. Focus stays on the card,
  and a live region announces "Sales: card 3 of 8".
- **Drag:** the handle, with a mouse, a finger or a pen (pointer events, no
  dependency). Escape cancels the drag.
- Pinned cards and the others are two groups: a card moves within its group,
  and pinning moves it to the other.

## Saved arrangement

Each user's arrangement is kept in `localStorage` under
`qdadm.dashboard.<id>.<user>` (the auth user's id or username, else
`anonymous`) as `{ v, order, hidden, pinned }`. Without storage (private
window, blocked) the arrangement lasts the page.

On every load it is reconciled with the declared cards:

- a card the app removed is dropped;
- a new card takes its default place, after its neighbour in the default order;
- a `required` card is never hidden, a `fixed` card is back at its default place;
- an unknown version starts from the default.

`useCardsArrangement(storageKey, cards)` is the same logic without the UI, and
`reconcileArrangement()` the reconciliation alone.
