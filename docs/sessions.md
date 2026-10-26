# Sessions: who else is here, and the sign-in history

`SessionsModule` tells each user who else has the admin open (a banner), and
gives admins a Sessions page: who is signed in, the sign-in history, and Close
on a session.

```js
import { SessionsModule } from '@quazardous/qdadm'

moduleDefs: [
  new SessionsModule({
    base: '/api/sessions',          // restSessionsAdapter(base)
    permission: 'admin:sessions',   // the page and its menu entry
    bannerSeverity: 'warn',
  }),
]
```

## The contract

`restSessionsAdapter(base, { fetch, headers, historyNotice, canClose })` speaks:

| Call | Answer |
|---|---|
| `POST {base}/heartbeat {tab}` | `{ others: [{ id, login, via, since, seen, tabs }] }` |
| `GET {base}` | `{ sessions: [... (+ ip, agent for an admin)], mine }` |
| `GET {base}/history?limit=&offset=` | `{ history: [{ at, event, login, via, by, reason, source, ip?, agent? }], notice? }` |
| `DELETE {base}/{id}?reason=` | an admin closes a session |

- `others` is the server's answer to "who else": the caller's own session (all
  its tabs) is not in it.
- `notice` says the history is incomplete (a provider's history unreachable). A
  server that reports it in its own field maps it:
  `historyNotice: (body) => (body.provider_history === 'down' ? 'Provider history unreachable' : null)`.
- `canClose: false` for a server without the `DELETE`: no Close button.
- Any other transport implements `SessionsAdapter` (`heartbeat`, `list`,
  `history`, optional `close`) and is passed as `adapter`.

## What it does

- **Heartbeat:** every `interval` seconds (default 30) while the tab is visible
  and someone is signed in, plus one at once when the tab comes back. The tab
  id lives for the tab (sessionStorage). It stops on `auth:logout` and starts on
  `auth:login`; a failed beat is retried at the next tick.
- **Banner:** "Also signed in: june (since 10 min), bob (since 2 h)" while the
  server reports others, through the app banner (`--qd-banner-height`). It is
  gone when they are. `bannerSeverity` (default `info`), or `banner: false`.
- **Sessions page** (`path`, default `sessions`; the route and its menu entry
  need `permission`, which the router enforces):
  - signed in now: who, via, since, last seen, tabs, and origin (ip, agent)
    when the server sends them; your own session marked;
  - the history, paged (`historyPageSize`, default 25): when, event, who, via,
    by whom, reason, source; the `notice` above it;
  - **Close** on a session other than yours, when the adapter can close and
    the user has `closePermission` (default `permission`): a reason is required
    and goes into the history.

## Options

| Option | Default | |
|---|---|---|
| `adapter` / `base`, `rest` | | The transport, or `restSessionsAdapter(base, rest)` |
| `interval` | `30` | Seconds between beats |
| `bannerSeverity` | `'info'` | |
| `banner` | `true` | |
| `permission` | | The page and its menu entry |
| `closePermission` | `permission` | Close a session |
| `path` | `'sessions'` | `false`: no page |
| `nav` | `{ section: 'Admin', icon: 'pi pi-users' }` | `false`: no menu entry |
| `historyPageSize` | `25` | |
| `labels` | | Any `core.sessions.<key>` text, a string or a function of its params (`banner` gets `{ list }`, `bannerOne` `{ name, since }`) |
