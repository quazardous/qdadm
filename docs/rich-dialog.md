# Rich dialog

A modal with a title, a scrolling area of stacked blocks and an action area.
It carries no business meaning: what's new, a welcome page, a licence or a
charter are only uses of it. qdadm draws the dialog and returns the choice.
Who has seen what, and when to open it, stays with the app.

## Open one: `useRichDialog()`

```js
import { useRichDialog } from '@quazardous/qdadm'

const { open } = useRichDialog()
const { action, values } = await open({
  title: "What's new",
  icon: 'pi pi-sparkles',
  blocks: [
    { kind: 'markdown', title: 'Version 2.65', meta: 'November 2026', source: '- Split buttons\n- Rich dialogs' },
  ],
  controls: [{ key: 'dontShowAgain', label: 'Do not show again' }],
  actions: [{ key: 'later', label: 'Later', severity: 'secondary' }, { key: 'ok', label: 'Got it' }],
})
// action: 'ok', 'later', or null when dismissed; values: { dontShowAgain: true }
```

`open()` returns a Promise of `{ action, values }`: the key of the button
chosen (`null` when the dialog is dismissed) and the controls' values. Opens
are **queued**: a second `open()` waits until the first is answered (a
licence at login, then what's new), and the dialogs never stack on top of
each other. The kernel mounts the host. An app with its own Vue app renders
`<QdadmRoot />`.

| Option | Default | |
|---|---|---|
| `title`, `icon` | | The header; the title also labels the dialog |
| `blocks` | | The content, stacked (below) |
| `actions` | `[]` | The buttons |
| `controls` | `[]` | Toggles, checkboxes, the app's own controls |
| `readToEnd` | `false` | The `requiresRead` buttons wait until the content was scrolled to its end |
| `dismissable` | `true` | Escape and × close it (`action: null`); `false` for a licence |
| `width` | `40rem` | |
| `maxHeight` | `60vh` | The scrolling area at most; the header and the actions stay put |
| `footer` | | The app's whole action area, a component (below) |

The component is `QdRichDialog` (`v-model:visible`, the same props, the
events `action` and `close` with `{ action, values }`), for a dialog that
lives in a page's template.

A what's new can open from the version in the sidebar: `app.versionAction`
makes it a button (see [Branding](branding.md#version-appversion)).

## Blocks: content handlers

Each block names its handler with `kind`, and may take a `title` and a
`meta` line (a date, a version):

| `kind` | Fields | |
|---|---|---|
| `text` | `text` | Paragraphs on blank lines, escaped |
| `markdown` | `source` | CommonMark with tables, rendered by `marked` |
| `html` | `source` | HTML |

Markdown and HTML are **sanitised** with `DOMPurify`: no script, no style, no
event handler, no form, no frame; links and images in http(s), mailto, tel
or relative only. An outside link opens in a new tab. Both libraries are
loaded the first time a dialog shows one.

The app adds its own kinds, the same way as cards and charts:

```js
import { registerDialogContent } from '@quazardous/qdadm'
registerDialogContent('myapp.changes', ChangesList)   // receives `block`
// { kind: 'myapp.changes', title: 'Version 2.65', items: [...] }
```

A kind nobody registered gets a warning in development and is skipped; the
rest of the dialog draws.

## The action area

- **Buttons:** `{ key, label, icon?, severity?, closes?, requiresRead? }`.
  A click answers with its key, and closes the dialog unless `closes: false`.
- **Controls:** `{ key, kind?, label?, value?, required?, …its own options }`,
  on the left, with the buttons on the right. Each control is drawn by a
  control handler: `toggle` (the default) or `checkbox`, or the app's own:

  ```js
  import { registerDialogControl } from '@quazardous/qdadm'
  registerDialogControl('myapp.assignee', AssigneePicker)
  // receives `control`, `modelValue`, `read`; emits `update:modelValue`
  ```

  Its value lands in `values[key]`. An unknown kind is warned in development
  and skipped.
- **The gate:** a `requiresRead` button stays disabled until the dialog is
  ready, that is read to its end (with `readToEnd`) and with its `required`
  controls filled (not `undefined`, `null`, `''`, `false` or `[]`). A short
  line says what is missing, linked to the button for screen readers. Content
  shorter than its box counts as read.
- **The app's own footer**, for anything else: `footer: Component` through
  the service, or the `#footer` slot on the component (`#actions` keeps
  qdadm's controls and replaces only the buttons). It receives:
  - `read` and `ready`;
  - `values`, the reactive values, which the app's own fields write into;
  - `resolve(action, extra?)`, which closes the dialog and answers with that
    action and the values merged with `extra`;
  - `close()`, which dismisses it.

## Keyboard and screen reader

The dialog is modal: the focus stays inside it, and goes back where it was
on close. It is labelled by its title. The scrolling area takes the focus,
so the keyboard can scroll it to its end. Escape closes the dialog only when
it is `dismissable`. A toggle and a checkbox are labelled by their text.

The demo's welcome page opens both uses: "What's new" (two blocks, one of
them drawn by the demo's own handler, and a "Do not show again" toggle), and
"Terms" (read to the end, not dismissable, with its own footer).
