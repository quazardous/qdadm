# @quazardous/qdadm-mcp

## 0.4.0

### Minor Changes

- 6f90761: `page_snapshot` says what the page is made of, not only what it shows (#2342).
  - **A header under the `Page:` line:**
    - the layout and page components, with their source file in dev (`Layout: MainLayout → AppLayout`, `Component: BookList (src/modules/books/pages/BookList.vue)`);
    - the entity and what the current user may do with it, with the permission key checked (`Entity: books — create ✓, update ✓, delete ✗ (checks entity:books:<action>)`);
    - on an item page, the active stack (entity and id at each level).
  - **qdadm zones in the tree.** A zone on screen shows as `zone "books-list-header" [blocks: filter-genre GenreFilter, export-btn ExportButton]`, with what it renders indented below it. Empty zones are left out.
  - **`filter: "interactive"`** adds `— in zone "…"` to each element inside a zone.
  - **`meta: false`** returns the tree as before, without the header and the zone lines.

## 0.3.0

### Minor Changes

- 13eadcb: An agent can drive the tab and see what its actions caused (#2247, lot A).
  - **`navigate`** opens a path, or a route name with params, like a user would. It waits for the page to settle, then returns the route reached, the page title and the breadcrumb.
  - **`wait_for`** waits for a route (a name, or a path prefix) or a signal matching a pattern, 30 s at most. On timeout it says where the tab is and which signals it saw.
  - **Action feedback.** On the relay, `navigate`, `bridge_call` and the entity writes return a `feedback` block with what happened in the tab while the call ran: route change, console errors and warnings, page errors and unhandled rejections, toasts, missing i18n keys, failed API calls, signals. A failing call says it too.
  - `recent_signals` now carries each signal's data.
  - Tool arguments can be numbers.

- ffe9cd0: The debug bar can offer real screenshots when an agent needs them (#2318).
  - `window.__qdadmRelay.capture.onSuggest(listener)` is called when an agent's `screenshot` came out rendered from the page because no tab capture runs. The agent's picture does not wait for it.
  - `capture.supported` says whether the browser can capture a tab at all.

- d031db8: The user can send the agent an annotated screenshot through the MCP tab's chat (#2309).
  - The controller's `chat.shoot()` takes a picture of the viewport for the MCP tab to annotate. It is rendered without the debug bar, or uses real pixels while a tab capture runs. `chat.send(text, image?)` posts it.
  - `chat_read` returns the new messages with each screenshot as MCP image content, and the message says `"screenshot": "image 1 below"`. The stdio front keeps those pictures in `.aiball/screenshots/` too (`…-chat.jpg`).
  - The Stop hook mentions it: `(with an annotated screenshot: read it with chat_read)`.
  - The chat keeps the last 5 screenshots for the tab. When the tab's storage is full, older ones are dropped first, never the text, and the message says `imageDropped`.

- b27fbc4: `qdadm-mcp-relay --chat-hook stop` is a Stop hook for agents that support hooks, such as Claude Code (#2252). When the agent is about to stop and the user wrote in a tab's MCP chat without an answer, it blocks the stop and gives the message as the reason, so the agent answers with `chat_send`.
  - Each message stops the agent once; `chat_read` still returns it.
  - With no relay, no tab or nothing new, the hook prints nothing and never gets in the way.
  - The relay serves it on `POST /chat/pending`, refused to web pages like `/mcp`.

- 1b1584d: `force: true` on `click`, `hover`, `drag`, `type_text` and `fill` (#2274): act even if the element is covered, not visible, disabled or read-only.
  - The answer lists what was skipped under `forced`, e.g. `["was covered by button \"Leave\" [ref=e56] in dialog …"]`, and the MCP history marks the request `force`.
  - Some things a forced action still cannot do, and the answer says so. A read-only field keeps its value, as it would for a real user, and the answer gives the value it holds. A click that never reaches the element is reported as such.
  - A stale ref and the debug bar stay refused.
  - A refusal without `force` now mentions that `force` exists.

- 8334eac: Act in the page like a user, on the relay (#2247), on the refs `page_snapshot` and `find` print:
  - `click` (right click, double click, modifiers), `type_text` (key by key: masks, number fields and autocompletes see every key), `press_key` ("Enter", "Shift+Tab", "Control+a", or a sequence), `hover`, `scroll`, `drag`, `upload_file`.
  - `fill` sets any field whatever the control: a text field is typed into, a checkbox or switch clicked when its state differs, a select or a PrimeVue dropdown opened and its option clicked, an autocomplete's matching suggestion picked, a date input set whole. A missing option lists those there are.
  - A click on a disabled element, or on one covered by a dialog or an overlay, is refused with the reason.
  - The defaults a browser runs only for real input run too, unless the app prevents them: Enter submits or presses, Tab moves focus, Space toggles, Backspace deletes.
  - Every action returns what it did, the dialog it opened or closed (with its ref), what has focus, the route, and the feedback block. After typing, it waits out the list's search debounce before answering.
  - The debug bar floating over the app is looked through, never clicked.
  - Nothing waits on animation frames or chained timers: the actions keep working in a background tab, where the browser suspends the first and slows the second.
  - `page_eval` runs JavaScript in the tab and hands back a JSON-safe value; elements come back with a ref.
  - `navigate` also takes `history`: back, forward or reload.
  - `console_messages` returns the tab's console: failures since it connected, and log, info and debug from the first call on.
  - `network_requests` returns the tab's fetch and XMLHttpRequest calls, with status and duration. A failed request also shows in the feedback block, as `failedRequests`.
  - `readOnly` (`--read-only`) now leaves out every tool that acts in the page, the entity writes included. Reading, hovering and scrolling stay.

- 61ca221: `screenshot`, on the relay (#2247): a picture of the tab that the agent receives as an MCP image. It covers the viewport by default, one element with `ref`, or the whole page with `fullPage`.
  - By default the picture is rendered from the page's DOM by snapdom, loaded on the first screenshot. It needs no permission, and the debug bar is left out.
  - For the real pixels, the user clicks **Allow real screenshots** in the MCP tab of the debug bar. The browser asks them to share the tab, and screenshots use that capture until they click **Stop sharing**.
  - `source` forces either kind (`dom` or `tab`); `format` and `quality` set the encoding.
  - Pictures are kept to 1600 px on their longest edge.

- c4dea79: Read the page like the user sees it, on the relay (#2247):
  - `page_snapshot` returns the tab as an accessibility tree, one line per element: role, name, states (checked, disabled, expanded or collapsed, required, invalid, current, focused…) and value, e.g. `- textbox "Title" [required] [invalid] [value="Dune"] [ref=e9]`. Every element carries a ref that stays valid while the element lives; a re-rendered one fails with a message saying to take a new snapshot. `filter: "interactive"` lists only what can be acted on; `ref` reads one part; long tables keep their first rows. Fields in error are listed at the end, label first. The debug bar is left out.
  - `find` looks elements up by role and/or text, and says where each sits (its row, dialog, form).
  - `page_text` returns the visible text.

  The three answer as plain text, not JSON. Names and roles come from `dom-accessibility-api`, loaded by the page on first use; `qdadmMcpPlugin` pre-bundles it so the first snapshot cannot make vite reload the page.

- 557fc86: One relay per machine between your app's tabs and your agents (#2231).

  **`npm run dev` starts it, and connects the app to it.** `qdadmMcpPlugin()` starts the relay if none is running, detached, so it outlives dev-server restarts. Every page the dev server serves connects at startup, with no click and no code. `relay: false` opts out.

  **Agents attach through the MCP stdio server `npx qdadm-mcp-relay --stdio`** (Claude Code: `claude mcp add qdadm -- npx qdadm-mcp-relay --stdio`). The stdio server attaches to the running relay, or starts one, and never fails at startup. Claude Code does not retry an MCP server that failed when the session started; only `/mcp › Reconnect` brings it back.

  **Instances.**
  - Every connected tab is an instance, with an id kept across reloads.
  - New `instances` tool: id, app, page, origin, how each connected, connected or reloading.
  - Every tool takes `instance` (an id, or its first 8 characters). Leave it out while a single instance is connected; with several, the error lists them.
  - `session` is still accepted as a synonym.
  - A reloading tab stays known for 30 s, and tools answer "reloading — retry" meanwhile.

  **The relay.**
  - Listens on the first free port of `47761–47765`, `127.0.0.1` only, and never crashes on a port in use.
  - That single port carries tab WebSockets, `GET /identity`, and `POST /mcp`, which refuses any request with an `Origin` header. `--mcp-port` is gone.
  - It writes `~/.qdadm_relay.run` (pid, port, page token, log; mode 0600; `QDADM_RELAY_RUN` to move it) and removes it on exit. A lock keeps a single relay.
  - Started in the background, it stops after 30 idle minutes.
  - The launcher runs the built relay when installed, so it no longer needs Node ≥ 22.18.

  **Chat.** `chat_send` shows a message in the tab's MCP panel, and `chat_read` returns what the user typed there since the last read. Every request a tab serves is also kept in its MCP history. Both survive reloads.

  **Outside dev** (static build, preview), a tab pairs from the debug bar's MCP tab: **Pair** shows a code, the user reads it to the agent, the agent calls `pair_accept`. The code never reaches the agent. `--origin` restricts who may pair. The `#qdadm-relay=…/<token>` fragment still connects a tab directly.

- b31462b: Screenshots are kept in the project (#2284). The stdio front (`qdadm-mcp-relay --stdio`), which the agent's MCP client starts in its project, writes every `screenshot` under `.aiball/screenshots/`, e.g. `20260911-112233-34fcb409-books-12-edit.jpg`, and the answer says where.
  - `--no-save-screenshots` turns saving off for the front; `save: false` on the tool skips one picture.
  - The relay's own `/mcp` endpoint and the dev-server endpoint write nothing: they have no project of their own.
  - A failed write never fails the screenshot: the answer says why the picture was not saved.
  - Add `.aiball/screenshots/` to your `.gitignore`.
  - A screenshot answer now carries `_meta["qdadm/screenshot"]`: the instance and page it shows.

### Patch Changes

- 5ba04d3: `fill` on a number field does what a user would (#2315).
  - **It leaves the field after typing.** PrimeVue's InputNumber keeps the typed value only when the field loses focus. Until now Save stayed disabled until the agent pressed Tab.
  - **It types the page's own decimal separator.** `"12.5"` and `"12,5"` both work, even on a page that writes decimals with a comma while the browser language says `en-US`. The answer says when it converted.
  - **It says when a field ends up holding something else than asked,** e.g. `— but it holds "125", not "12.5"`. Formatting of the same number (`"12,50"` for `12.5`) is not reported.

- ae99556: The relay knows which page the tab is on, after every navigation (#2317).
  - **The tab tells the relay its page again after each route change.** `instances`, the Stop hook line and screenshot file names (`…-books-12-edit.jpg`) no longer keep the page the tab connected on.
  - **Under hash routing the page is the route in the hash:** `/#/books`, not `/`.

- 723df17: DOM screenshots of a scrolled page show fixed elements where the user sees them (#2312).

  A `position: fixed` sidebar came out cut, with black under it, and a full-screen overlay came out garbled: the page is rendered whole, as at scroll 0, then cropped at the scroll. The clone snapdom renders now gives each fixed element the box the user sees. The page itself is not touched, and a picture of one element or of the whole page renders as before.

- 40fb510: `page_snapshot` and `find` list password, date, time, datetime-local, month, week, color and file inputs (#2291). These inputs have no ARIA role, so the snapshot left them out, and an agent had no ref for them.
  - They are listed as Playwright's snapshot lists them, with their type: `textbox "Password" [type=password] [required] [value="••••••"]`, `textbox "Due" [type=date]`, `button "Cover" [type=file]`. A password's value is never shown.
  - Action messages name them the same way, e.g. `set textbox "Due" [type=date] to "2026-09-11"`, instead of `date input "Due"`.

## 0.2.2

### Patch Changes

- 5c5c1e2: Fix: the built entry points exist after a plain `npm install`, not only after `npm pack`. Pointing `exports` at `dist/` (#1895) paired it with a `prepack` hook, which npm runs when packing or publishing — but not on install. A workspace link or a `file:` dependency therefore had no `dist/`, and any bundler resolving `@quazardous/qdadm/vite` or `@quazardous/qdadm-mcp` failed with "Failed to resolve entry for package". The hook is now `prepare`, which npm runs on install _and_ before pack and publish, so every consumption path gets the build.

## 0.2.1

### Patch Changes

- e4fd1dd: Fix: the MCP vite plugin can be imported from a real npm install (#1895, BookShepherd report). `exports` pointed at raw `.ts`, and Node refuses to strip types under `node_modules` — so a `vite.config.js` importing `qdadmMcpPlugin` died with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, exactly as `@quazardous/qdadm` did before 2.16.1. Fixing qdadm alone moved the failure rather than removing it: a vite config does not load halfway, so one raw `.ts` under `node_modules` still took the whole config down. The package now builds to `dist/` via `prepack`. Unlike qdadm it is compiled end to end, because nothing here is bundled by a consumer's app — it is a vite plugin and an MCP server, both loaded by Node. The consumer-smoke gate now packs and imports this package alongside qdadm, and resolves a vite config using all three plugins: a gate watching one package of a family reports green while the consumer is blocked.

## 0.2.0

### Minor Changes

- ed9c583: Agent-grade error messages across the toolset (#1497, skybot testbed feedback). Tool registration moves to the low-level MCP Server: advertised JSON Schema keeps `required` correctly declared, and argument validation is now ours — failures come back as one actionable sentence (no more raw ZodError dumps), with the registered entity names appended when an `entity` argument is missing and a session is reachable. `boot_errors` tells the truth: its description and its no-session message now say it needs an open tab — a blank page counts, the pre-boot capture loads before the app. Minor (not patch): the exported `ToolDef` shape changed (plain `args` specs replace zod `inputSchema`).

## 0.1.0

### Minor Changes

- 516a440: Initial release: MCP server for running qdadm apps (#1398)

  `qdadmMcpPlugin()` (vite dev plugin) exposes a stateless Streamable-HTTP
  MCP endpoint at `/__qdadm/mcp` over qdadm's debug broker. Curated toolset —
  session_info, boot_errors, routes, entity_state, entity_list/get/create/
  update/delete (readOnly option), storage_dump, recent_signals, describe,
  bridge_call — every response session-stamped. Dev-server only by
  construction; works behind an HTTPS vhost/proxy.

- 9ae1e74: MCP relay for static/no-API sites (#1400): `npx qdadm-mcp-relay` accepts a
  page's outbound WebSocket (token pairing) and fronts the same 13-tool MCP
  (Streamable HTTP + --stdio). Opt-in browser connector at
  `@quazardous/qdadm-mcp/connector` — inert without the
  `#qdadm-relay=<ws-url>/<token>` URL fragment, boot-error capture included.
