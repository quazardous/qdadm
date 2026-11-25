# The edge bar

A thin bar on an edge of the layout, with tabs hooked onto it, and a panel
laid over the content: for what goes with the page without pushing it aside,
such as a task's memory, messages, notifications or help.

The app decides what it shows and when. One handler is given the page's
context and returns the panels for it:

- a **global** panel is returned on every page;
- a **contextual** panel is returned only in its context, such as a task's
  page, with that task.

```js
import { ref } from 'vue'
const unread = ref(0)

createKernel({
  features: {
    edgeBar: {
      side: 'right',     // or 'left'
      tabsAt: 'top',     // or 'bottom': where the tabs sit along the bar
      pinnable: true,    // a pin on the panel (false: none)
      resizable: true,   // a handle on its inner edge (false: none)
      minWidth: '18rem', // the narrowest it may be dragged to
      maxWidth: '60vw',  // the widest (never past 92vw)
      width: '26rem',    // the panel's, at most 92vw
      narrowAt: 900,     // under it, the panel takes the screen's width
      panels: (context) => {
        const task = context.entity('tasks')
        return [
          { key: 'inbox', label: 'Messages', icon: 'pi pi-inbox', component: Inbox, badge: unread },
          ...(task
            ? [
                { key: 'client', label: 'Client', icon: 'pi pi-user', tone: 'watch', component: TaskMemory, props: { taskId: task.id, universe: 'client' }, badge: () => waiting(task.id, 'client') },
                { key: 'supplier', label: 'Supplier', icon: 'pi pi-truck', tone: 'info', component: TaskMemory, props: { taskId: task.id, universe: 'supplier' } },
              ]
            : []),
        ]
      },
    },
  },
})
```

## The context

`panels(context)` is called again whenever the context changes: an entity
level of the context stack (`useActiveStack()`), the page's domain, the route or the
user.

| Field | What it holds |
|---|---|
| `levels` | The entity levels with their ids, root first: `/tasks/12/notes/3` gives `tasks(12)`, `notes(3)` |
| `current` | The deepest level, or null |
| `entity(name)` | The level of that entity, or null: `context.entity('tasks')?.id` |
| `domain` | The page's domain, or null |
| `route` | `{ name, path, params, query }` |
| `user` | The signed-in user |

## A panel

| Field | |
|---|---|
| `key` | Unique among the panels returned |
| `label` | The tab's name; an i18n key works |
| `icon` | An icon class |
| `tone` | The tab's colour: `critical`, `watch`, `good`, `info`, `neutral`, the app's own `--qd-tone-<name>`, or a CSS colour |
| `badge` | What waits there: a number, a ref or a getter. It stays live while the panel is closed; 0 or none hides it |
| `component`, `props` | What the panel draws |

When the handler returns nothing, there is no bar. When it throws, there is no
bar either, and a warning is logged.

## Gestures

The tabs are one strip of joined handles, the chevron at its outer end. They
and the panel form one drawer that slides as a single block: closed, only
the tabs show past the edge; opening slides the panel in with the tabs on its
edge, in one motion (`--qd-edge-duration`, 0.32s). Closing reverses it, the
panel's content still drawn until the drawer is shut; once closed, the panel
is hidden and inert.

- A tab opens the panel on it; clicking the open tab closes it. The chevron,
  a click outside and Escape close it too.
- The panel is closed when the app opens. The tab used last is kept for the
  session.
- From one page to the next, the panel stays open on its tab while that tab
  is still returned. When the tab is no longer returned (you left the task),
  the open panel falls back to the first panel left, and closes when none is.
- The content keeps the bar's room (a margin on its side) only while there
  is a bar.

## Resized

A handle on the panel's inner edge, the side facing the page, sets its
width:

- dragging it moves the width within `minWidth` and `maxWidth`;
- a double click goes back to `width`;
- from the keyboard, the handle is a `separator` with its value, min and
  max: the arrows move 16px (64 with Shift), Home and End go to min and max;
- the browser keeps the width (`localStorage`);
- pinned, the page's room follows it while dragging.

On a narrow screen there is no handle: the panel takes the screen's width.
`resizable: false` takes the handle away.

## Pinned

A pin in the panel's head keeps it beside the page:

- the page makes room for it, in the drawer's motion, and the panel shows a
  line rather than a shadow;
- a click in the page, the focus leaving it and Escape no longer close it;
  the chevron and the open tab still do;
- it stays open from page to page, falling back as above when its tab is no
  longer returned; with no panel returned, the bar goes and the page takes
  its room back;
- the browser keeps the pin, with whether the panel was open and on which
  tab (`localStorage`): a reload opens it pinned again.

On a narrow screen there is no pin: the panel opens over the page, at full
width. `pinnable: false` takes the pin away.

A page opens a panel itself with `useEdgeBar()`:

```js
import { useEdgeBar } from '@quazardous/qdadm'
const edge = useEdgeBar()
edge.open('client')   // false when that panel is not returned for this page
edge.close()
edge.pin(true)        // pinned, beside the page
edge.resize(480)      // px; null: back to the configured width
// edge.isOpen, edge.tab, edge.panels, edge.present, edge.pinned, edge.docked, edge.width
```

## Accessibility

- The chevron has `aria-expanded` and `aria-controls`.
- The tabs are a vertical `tablist`, moved through with the arrows. A tab's
  name carries its badge (« Client, 2 unread »).
- The panel is a `tabpanel` named after its tab. The focus goes into it when
  it opens, and back to the tab or the chevron that opened it when it
  closes.
- Under `prefers-reduced-motion`, it opens without sliding.

## Look

The tokens, set on `:root` (and under `.dark-mode`):

| Token | Default |
|---|---|
| `--qd-edge-bar-width` | `8px` |
| `--qd-edge-tab-size` | `2.25rem` |
| `--qd-edge-bar-bg` | the primary colour |
| `--qd-edge-tab-bg`, `--qd-edge-tab-ink` | the content's |
| `--qd-edge-panel-bg`, `--qd-edge-panel-shadow` | the content's, a soft shadow |
| `--qd-edge-z` | `1050` |
| `--qd-edge-duration` | `0.32s`, the drawer's slide |

A layout of the app's own draws the bar with `<QdEdgeBar />`, which reads
`features.edgeBar`. It can also draw `QdEdgePanel` directly, with `panels`,
`v-model:open`, `v-model:tab`, `v-model:pinned`, `pinnable`, `size`
(`update:size`), `resizable`, `minWidth`, `maxWidth`, `side`,
`tabsAt`, `width`, `narrowAt`, and a slot per
panel (`#tab-<key>`) or `#default` (`{ panel }`).

The demo returns Activity on every page and Comments on a book's page
(`packages/demo/src/edge/`).
