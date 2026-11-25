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

- A tab opens the panel on it; clicking the open tab closes it. The chevron,
  a click outside and Escape close it too.
- The panel is closed when the app opens. The tab used last is kept for the
  session.
- From one page to the next, the panel stays open on its tab while that tab
  is still returned. When the tab is no longer returned (you left the task),
  the open panel falls back to the first panel left, and closes when none is.
- The content keeps the bar's room (a margin on its side) only while there
  is a bar.

A page opens a panel itself with `useEdgeBar()`:

```js
import { useEdgeBar } from '@quazardous/qdadm'
const edge = useEdgeBar()
edge.open('client')   // false when that panel is not returned for this page
edge.close()
// edge.isOpen, edge.tab, edge.panels, edge.present
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

A layout of the app's own draws the bar with `<QdEdgeBar />`, which reads
`features.edgeBar`. It can also draw `QdEdgePanel` directly, with `panels`,
`v-model:open`, `v-model:tab`, `side`, `width`, `narrowAt`, and a slot per
panel (`#tab-<key>`) or `#default` (`{ panel }`).

The demo returns Activity on every page and Comments on a book's page
(`packages/demo/src/edge/`).
