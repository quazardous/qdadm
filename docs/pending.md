# Waiting states: reads that take their time

A page reads several things at once: the server's state, the refs, the
builds. Until a read arrives, the page must say it is waiting. An empty area
says nothing, and a value shown before it is read ("no backup", in red) says
something false.

Three pieces work together: a composable for the read, a badge and an area that
wait on it.

## useAsyncRead

```ts
import { useAsyncRead, useOrchestrator } from '@quazardous/qdadm'

// The call lives on the entity's manager, not in the page (docs/RULES.md, rule 2)
const { getManager } = useOrchestrator()
const servers = getManager('servers')
const backups = useAsyncRead(() => servers.backups(serverId.value), { key: () => serverId.value })
```

```js
// In the module: the manager owns the calls that are not one record
class ServersManager extends EntityManager {
  backups(id) {
    return api.get(`/servers/${id}/backups`).then((r) => r.data)
  }
}
```

It returns `{ data, error, loading, ready, pending, load }`:

| | |
|---|---|
| `data` | `undefined` until the first answer, then the last good answer, `null` and `[]` included |
| `ready` | `true` once a read has succeeded, for good: `data` is an answer, even an empty one |
| `loading` | a read is in flight; `true` from the start when the read starts at once |
| `pending` | `loading` or not `ready`: put it in the `:disabled` of a gesture that needs the data |
| `error` | why the last read failed, as a readable message, or `null` |
| `load()` | read again: a retry, a refresh |

- The read starts at creation (`{ immediate: false }` to start it yourself), so
  the first render already shows the wait.
- The latest call wins: an earlier answer arriving late is dropped.
- `{ key: () => id.value }`: what the read is about. A new key reads again from
  scratch, not ready: the previous record's answer never shows under the next
  one, without keying the component.
- A failure stops `loading`, sets `error`, and keeps the last good `data`.
  The next successful read clears `error`.
- Test `ready`, never the truthiness of `data`: `null` and `[]` are answers.

```vue
<Button label="Deliver" :disabled="preview.pending.value" @click="deliver" />
```

## QdPending: a badge that waits

```vue
<QdPending :read="code" label="Reading the deployed code…" v-slot="{ value }">
  <Tag :value="value.ref" severity="success" />
</QdPending>

<QdPending :value="state" label="Reading the server…"><Tag :value="state" /></QdPending>
```

- Until the value is read, a neutral tag (`secondary`) with a spinner and the
  label (default "Reading…") stands in for the badge.
- Then the slot shows, with `{ value }`. With `:value`, `undefined` means not
  read yet; `null` has arrived.
- A failed read shows a muted "Unavailable" tag, the error in its tooltip. It is
  never orange or red: a read that failed is not a warning about the thing read.
  With `:read`, a retry button sits next to it (`:retry="false"` drops it).
- `role="status"`, and `aria-busy` while it waits.

## QdPendingZone: an area that waits

```vue
<QdPendingZone :read="backups" v-slot="{ data }">
  <p v-if="!data.length">No backup yet.</p>
  <BackupsTable v-else :rows="data" />
</QdPendingZone>
```

- First read: a skeleton (`lines`, 3 by default), or a spinner with its label
  (`variant="spinner"`). `min-height` keeps the page from jumping.
- A first read that fails: the error, readable, and **Retry**, which calls
  `read.load()` (and emits `retry`). The `#error` slot (`{ error, retry }`)
  replaces it.
- Read again with data on show: the content stays, dimmed, with a small spinner
  in its corner. If that read fails, the content stays and a line under it says
  so, with Retry.
- `aria-busy` while a read is in flight.
- Without a composable: `:loading`, `:error`, and `:ready` (by default, not
  loading and no error).

## Motion

Under `prefers-reduced-motion`, the spinners stand still and the skeleton does
not shimmer; the label and the skeleton's shape still say that it waits.
