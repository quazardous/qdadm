# Changelog

## 2.22.1

### Patch Changes

- fac6dde: Cancel on a dirty form opens one "Unsaved Changes" dialog, not two (#2267).

  `AppLayout` and `BaseLayout` render the guard dialog a form registers, and `FormPage` rendered its own from the same `guardDialog` prop, so both opened at once. `FormPage` now renders it only when no qdadm layout above it does; an app with its own layout keeps FormPage's dialog.

## 2.22.0

### Minor Changes

- 73dc5fd: Form labels name their field (#2268).
  - **`FormField`'s label now points at the control inside it.** Clicking the label focuses the field, and screen readers and agents read the field by its label (`textbox "Title"`, `combobox "Genre"`).
  - **The ids are unique per field instance,** so two forms on one page do not collide.
  - **`FormInput` binds the id with each PrimeVue control's own prop.** A widget put directly in the slot takes it after render, or keeps its own id and the label follows. The slot also receives `inputId` and `labelId`.

- 4002c6a: A `number` field can hold decimals (#2316). Its form input accepted whole numbers only, so typing `12.5` saved `125` without any error.
  - `fractionDigits: 2` (always two decimals) or `fractionDigits: { min: 0, max: 2 }` sets how many digits the input accepts after the decimal point.
  - `min`, `max` and `step` bound the input and set its increment.
  - A field without these options renders as before, and a stored value that already has decimals still shows them.

- 557fc86: The debug bar gets an **MCP** tab (#2231), after i18n, where the app installed `@quazardous/qdadm-mcp/connector`. No connector, no tab.

  It shows how this browser tab reaches the relay:
  - **Dev page:** connected, with its instance id and the relay; or offline and retrying.
  - **Other pages:** **Pair**, then the code to give the agent, then **Unpair**. It also says when no relay answered, or when the browser holds the connection back: on a public https origin, Chrome waits for the user to allow local network access.

  The tab's **instance id** sits at the top of the panel: click it to copy it, and give it to your agent when several tabs are open. Three sub-tabs sit under it:
  - **Status**: the connection;
  - **Chat**: with the agent, badged while its messages are unread;
  - **History**: every MCP request the tab served, with tool, detail, success or error, and duration. Its badge lights while a code waits or on an error.

  `RelayCollector` and `RelayPanel` are exported from qddebug. The collector redacts the code from `snapshot()` and its actions: the debug bridge is readable over HTTP and MCP, and a code must reach the agent through a human. `debugBar({ relayCollector: false })` hides the tab.

- b7e072a: `import '@quazardous/qdadm/styles'` now loads a stylesheet compiled at publish time, so an app no longer needs sass (#2260). The import is the same, and so is the result.
  - The raw SCSS stays available as `@quazardous/qdadm/styles/scss`, for whoever compiles it with their own settings. `@quazardous/qdadm/styles/variables` is unchanged, and both still need sass.
  - Theming is unaffected: qdadm's colours are CSS custom properties, set at runtime.

- d613838: `RoleGrantsEditor`: a role's composition, made readable (#2313).
  - **What it shows:** the roles a role inherits, an entity × action matrix of the registry's entity grants, and the named grants grouped by namespace.
  - **Every checked grant says where it comes from:** the role's own key, one of its wildcards (`via entity:*:read`), or an inherited role (`via ROLE_USER`). Inherited and covered grants are greyed and can't be unchecked there.
  - **`v-model`** is `{ inherits, permissions }`, the role's own composition only. Keys the registry does not know are kept and listed.
  - **It judges nothing.** The roles to inherit from and what they bring (`inherited: [{ permission, via }]`) come from the app. qdadm's roles provider computes them with the new `inheritedGrants()`; an app whose server judges sends them.
  - **`SecurityModule`'s role form** now uses it, instead of the role-name autocomplete and the raw-key `PermissionEditor`. `PermissionEditor` is still there for raw keys.
  - **New from `@quazardous/qdadm/security`:** `composeGrants`, `inheritedGrants`, `originOf`, `setGrant` and their types.
  - **Wording:** new `core.roles.*` keys in the en and fr defaults.

- 557fc86: The vite debug bridge keeps a tab's session id across reloads (#2231).

  The id now lives in `sessionStorage`, so an agent targeting `?session=<id>` keeps its target through F5. A tab that says bye stays known for `reloadGraceMs` (default 30 s): a request sent to it meanwhile fails at once with "reloading — retry" instead of waiting out its timeout. `latest` prefers a connected tab over one still reloading, and `/__qdadm/sessions` entries carry `connected`.

- 9d94fd4: `useSecurity()`: ask for a permission from a component (#2242).

  `const { isGranted } = useSecurity()` returns the same verdict as the entity managers — the app's `security.grant` judge first, then the role matrix — for a permission or a `ROLE_*`, optionally about a subject.
  - **No cache:** the remount on `security:changed`, login and logout is what makes a `v-if="isGranted('…')"` show new answers.
  - **No security configured:** it grants, like the managers.

  See docs/security.md, "In a component: `useSecurity()`".

### Patch Changes

- fd12d50: qdadm's default translations now include `breadcrumb.view` / `breadcrumb.edit` (en: View / Edit, fr: Voir / Modifier), the labels of the breadcrumb's View↔Edit toggle (#2270). Every app with `breadcrumbModeToggle` used to report both keys as missing on item pages, and a French UI showed the English fallbacks. An app that defines these keys itself keeps its own translation.
- e606b89: A lazy page whose chunk fails to load no longer leaves a blank screen (#2295). This typically happens in a tab left open across a deploy: the old build asks for chunks that no longer exist.
  - qdadm reloads the page once, at the page the user was going to, which loads the new build.
  - If that page fails again, it does not reload a second time. It shows an error toast that stays until dismissed: "A new version is available — This page could not be loaded. Reload the page to get the new version."
  - The guard is a sessionStorage flag, cleared by the next navigation that succeeds. Without sessionStorage, it only shows the toast.
  - Vite's `vite:preloadError` is handled the same way. Other navigation errors are left alone.

- 0792db3: Escape closes the delete confirmations (#2269).

  The list row delete, the bulk delete, and the delete of the form and show pages now close on Escape. Nothing is deleted: Escape hides the dialog without accepting. PrimeVue's ConfirmDialog closes on Escape only when the confirmation asks for it, and none of qdadm's did.

- 750d244: A native checkbox, radio, range or colour input inside a `FormField` keeps its own size (#2319). qdadm's form styles forced every `input` in a `.form-field` to `width: 100% !important`, so a native checkbox was stretched across the whole row. A checkbox or radio placed directly in the field is no longer stretched by its flex column either. Text-like inputs and PrimeVue's own controls still take the full width; PrimeVue's Checkbox, RadioButton and ToggleSwitch look as before.
- b471072: An app without `qdadmVitePlugin()` in its vite config now says so (#2259). Until now it died at boot on PrimeVue's `No PrimeVue Toast provided!`, which never named qdadm.
  - In dev, the kernel logs one error, before installing PrimeVue, naming the plugin and how to add it.
  - The toast listeners add the same hint to PrimeVue's error.
  - The plugin defines `__QDADM_VITE_PLUGIN__` for the check.

- b8ca627: A first visit no longer lands on `/login?session_lost=1` (#2292).

  The auth guard added `session_lost=1` to every redirect to login. It now adds it only when a session this tab had is gone, the same case that emits `auth:session-lost`. A first visit goes to `/login`, so an app can read the flag to tell a returning user their session expired.

- a25a3bb: ShowPage with a `#media` slot: the fields column no longer grows to its longest unbreakable content (a URL, a `<pre>`) and pushes the card past its container. Both grid tracks — desktop and below 768px — are `minmax(0, 1fr)`, so such content scrolls or wraps inside the column.
- Updated dependencies [d031db8]
- Updated dependencies [ffe9cd0]
- Updated dependencies [8324553]
- Updated dependencies [61ca221]
- Updated dependencies [557fc86]
  - @quazardous/qddebug@1.3.0

## 2.21.0

### Minor Changes

- d1a2251: Let the application provide the permission judgement (#2225).
  - `security.grant: { isGranted(attribute, subject, user), install?(ctx) }` is consulted before the role matrix, for roles and permissions alike. `true`/`false` is the verdict; anything else falls through to `role_hierarchy`/`role_permissions`, which stay the default. A judge that throws denies. A `grant` without `isGranted` fails at boot instead of being skipped.
  - `install(ctx)` — for both `security.grant` and a `rolesProvider` — now receives `permissionRegistry`, so the app can pre-warm every registered key in one request. Read `getKeys()` at fetch time: modules register their entities after `install` runs.
  - New signal `security:changed` (`SIGNALS.SECURITY_CHANGED`): emit it when your answers change and the app remounts, as on `auth:login`. Emit only on an actual change — a remount discards unsaved form state.
  - The debug bar's auth panel shows the delegated verdicts for every registered permission.

  See docs/security.md, "Delegating the judgement to your backend".

### Patch Changes

- 65a0c01: Two things the docs never said, both found by a consumer hitting them

  **`auth:login` is emitted by `LoginPage`, and by nothing else.** It describes a
  screen, not a change of authentication state — and several things wait on it:
  the `auth:ready` deferred, the expired-session guard re-arming, role loading in
  a `PersistableRolesProvider`, and the live-entity stream. An app that replaced
  the login screen gets none of them, and none of them fails loudly. `security.md`
  now says so, with the one line that fixes it.

  **`live-entities.md` never said when the stream connects.** It does now, as a
  table of the three ways into a session — a valid session at boot connects
  directly, a `LoginPage` login connects via the signal, and **your own login
  screen connects nothing** unless it emits `auth:login` itself. The third row is
  the one that bites: pushed updates simply do not arrive for that session, with
  no error anywhere.

  **And `isAuthenticated()` is synchronous**, which `security.md` now spells out
  along with what follows from it: an app whose session lives in a refreshable
  token must revalidate _before_ mounting, or the route guard runs against a
  session not yet restored and drops the user on `/login?session_lost=1` holding a
  perfectly valid credential.

  No code changed. Every claim in both pages was checked against the source rather
  than remembered — a document cannot go red on its own, so it has to be held
  against something that can.

## 2.20.0

### Minor Changes

- c76b488: Route state: five media to choose from, and three levels to choose at

  The seam had one persister. It now has the set, and somewhere to declare it
  other than on every list.

  ```js
  new Kernel({ routeState: 'url' }) // the app-wide floor
  ctx.entity('audit_rows', { routeState: 'local_storage' }) // every screen showing it
  useListPage({ entity: 'offers', routeState: 'none' }) // this screen only
  ```

  Most specific wins: **the list → the entity → the kernel → the URL.** Each
  level exists because somebody has to be able to say it there — a screen's
  medium is a screen's decision, an entity's is a modelling one, and an app-wide
  floor belongs in the bootstrap.

  | Slug              | Medium               | Reach for it when                                |
  | ----------------- | -------------------- | ------------------------------------------------ |
  | `url`             | query string         | the state is worth sending someone — the default |
  | `local_storage`   | `localStorage`       | worth keeping, not worth linking                 |
  | `session_storage` | `sessionStorage`     | worth keeping until the tab closes               |
  | `cookie`          | one cookie per scope | the **server** needs to read it                  |
  | `memory`          | a shared map         | survives navigation, not a reload                |
  | `none`            | nowhere              | this screen forgets, and says so                 |

  Each medium keeps the same contract and differs only where the medium really
  does:
  - **The cookie stores one blob per scope**, not one entry per key, because
    every cookie rides on every request to your origin — eight filters must not
    become eight cookies on every image the page loads. It is also the only one
    worth reaching for when the _server_ reads the state; otherwise it is wire
    cost for nothing.
  - **Memory outlives the persister that wrote it.** A list rebuilds its
    persister on mount, so state held on the instance would die on exactly the
    navigation this is meant to survive.
  - **Web storage that throws does not take the screen down.** Private browsing,
    blocked site data and a full quota all raise rather than return null; qdadm
    warns once, naming the medium, and the list keeps working. Announced, so not
    the silent no-op [ADR 0011](docs/adr/0011-no-silent-no-ops.md) forbids.
  - **`none` is reached only by name.** Nothing falls back to it and an unknown
    slug still throws — it does nothing because somebody wrote it down.

  **Values keep their type outside the URL.** A query string coerces, because
  people read it: `?level=42` returns the number 42. The other media store JSON,
  so a filter holding the _string_ `'42'` stays a string there. It matters to
  code comparing with `===`.

  Key naming is overridable per medium, since the right scheme differs by
  medium: dots in a query string, colons in web storage, and underscores in a
  cookie — where a name is an RFC 6265 token that may contain neither.

  New doc: [route-state.md](docs/route-state.md).

- 911f150: The default is composed: the page in the link, the row count out of it

  Lot C. The seam's signature was chosen so composition would be expressible
  without changing it, and qdadm's own default turned out to be the case that
  needed it.

  Filters, search and the page belong in a link — that is the whole argument for
  the URL being the default. **Rows-per-page does not.** It is a comfort setting
  somebody picked once, and a link carrying it would impose the sender's row
  count on whoever opens it. So the default routes by key:

  ```js
  new CompositePersister({
    fallback: new UrlPersister({ router, route }),
    keys: { pageSize: { persister: new CookiePersister(), scope: 'app' } },
  })
  ```

  Which is what qdadm was already doing, by accident of where the code happened
  to live. It is now a decision you can read, override, or copy.

  **Your saved row count survives.** It moves from a bare `qdadm_pageSize`
  cookie to a `qdadm_app` blob; the old cookie is read when the new store has
  nothing, and retired on the first change. Verified in a browser both ways —
  upgrade with only the legacy cookie present, and a reload after a change.

  ⚠️ **`routeState: 'url'` is not "the default, stated out loud".** It is a pure
  URL persister, so the row count joins the query string. Say `'default'` if you
  meant the default.

  Composing your own works the same way — route any key to any persister, and
  pin it to a fixed `scope` when it is one setting across the app rather than one
  per screen. Two behaviours worth knowing:
  - **A routed key wins over the fallback.** A stale `?pageSize=50` somebody
    left in a URL does not beat the cookie that owns the setting.
  - **Clearing a list leaves pinned keys alone.** "Clear this list's filters" is
    not a request to reset an app-wide row count — otherwise one list's clear
    button would change every other list's.

  An invalid stored size falls back to the default rather than being honoured:
  the value arrives from a cookie or query string anyone can edit, and a row
  count the paginator cannot offer would leave its dropdown blank.

- 36c7bec: A seam for route-state persistence: `RouteStatePersister`

  Where a route remembers what it is showing is now one interface with one rule,
  instead of five unrelated sites that never met: filters in `sessionStorage`
  AND the URL, sort in `sessionStorage` only, page size in a year-long global
  cookie, the current page nowhere at all until recently. Each was invented
  where it happened to be needed.

  The list is one **consumer** of routing state, not the subject — a detail
  page's active tab and a dashboard's date range are the same problem, and would
  each invent their own answer without this.

  ```js
  import { UrlPersister, resolveRouteStatePersister } from '@quazardous/qdadm'
  ```

  A handler is a **slug or an instance**, the same convention `storage` already
  follows, so consumers meet one shape rather than two. An unknown slug
  **throws** rather than quietly falling back to the URL — a persistence choice
  that silently does something else is the failure
  [ADR 0011](docs/adr/0011-no-silent-no-ops.md) forbids, and the one this seam
  exists to clean up after.

  `UrlPersister` is the default medium, because it is the only one where "what I
  am looking at" is also "what I can send you". It goes through the router the
  app already has, with `replace`, and touches no route declaration. **Keys are
  namespaced by scope** (`offers.page=2`), which is what will let two lists share
  a route — the collision `page-compositions.md` currently tells people to avoid
  by switching persistence off entirely.

  **Nothing consumes it yet.** `useListPage` keeps its current behaviour
  unchanged; wiring it up is the next step, deliberately separate so that the
  seam can be judged before anything moves onto it.

  Chrome preferences stay out by design: a collapsed sidebar belongs to the
  person, not the route — sending someone a link must not fold their menu.

- 4a96272: `useListPage` remembers its state through the seam — and its URL keys are now scoped

  The list stops writing the query string by hand and goes through
  `RouteStatePersister`. The default is still the URL and still `replace`, so
  paging is still not a history step of its own.

  **What you will see change: the keys carry the entity.** A list of offers
  writes `?offers.page=2&offers.search=nginx`, not `?page=2&search=nginx`. That
  is the point — it is what lets two lists live on one route without fighting
  over a single `page` parameter, the collision `page-compositions.md` used to
  tell people to dodge by turning persistence off.

  **Links written before this keep working.** An unprefixed `?page=2` is still
  read when the scope has nothing of its own, so bookmarks and links pasted into
  tickets land where their sender was. The first write retires the flat key
  rather than leaving two — and so does clearing the filters, which previously
  would have left the address claiming a page the list was no longer showing.

  **How to tell whether this reaches your code at all**, in one sweep — a
  consumer who never reads the address bar for list state is entirely unaffected,
  and most are:

  ```
  route.query / $route.query      any read of `page`, `search` or a filter name?
  location.search / location.href same
  searchParams                    same — ignore the ones BUILDING an API request
  ```

  Hits on a list key mean an assertion or a feature of yours expects the flat
  shape and will now read `null`; no hits mean nothing to do. Worth two minutes
  before upgrading rather than finding out from a test that looks like a
  regression — a check for `page` returning `null` is indistinguishable from the
  fix having failed. Read both forms if you need to straddle the versions:
  `q.get('offers.page') ?? q.get('page')`.

  (That sweep is BookShepherd's, from qdadm#2154, generalised here with thanks.)

  Choose the medium per list:

  ```js
  useListPage({ entity: 'offers', routeState: 'url' }) // slug…
  useListPage({ entity: 'offers', routeState: myPersister }) // …or instance
  ```

  `syncUrlParams` keeps the meaning it always had, which is narrower than its
  name suggests: it governs **writing**. It has never stopped a query string
  being read, and a hand-typed deep link still restores the list. Setting
  `routeState` is a deliberate choice of medium, so it answers that flag rather
  than obeying it.

  A filter named `page` or `search` still warns. The scope separates this list
  from _other_ lists, not from qdadm's own keys, so within one list the
  collision is real and the warning still names what wins.

- 7d45b6c: Route-state keys go through an overridable locator

  Hard-coding `offers.page` inside `UrlPersister` would make the naming scheme a
  property of qdadm rather than of the app. `RouteStateKeyLocator` — `encode`,
  `decode`, `looksScoped` — moves that decision out, **one per persister type**,
  because the right scheme differs by medium: dots read well in a query string,
  colons are the convention in web storage.

  ```js
  new UrlPersister({ router, route, keyLocator: myScheme })
  ```

  `decode` returns null for a key belonging to somebody else. That is what lets
  a persister pick its own entries out of a medium it shares with everything
  else, and it is the whole reason scopes exist.

  **Old flat links keep working.** qdadm wrote `?page=2` unprefixed before this
  seam, and those links are in bookmarks and pasted into tickets. `UrlPersister`
  reads unprefixed keys when its scope has none of its own, so such a link still
  lands on the right page instead of silently showing page 1. Writes are always
  prefixed, so a link refreshes itself the first time anyone touches the list,
  and the legacy key is retired then rather than left to shadow its replacement.

  The fallback reads only keys **nobody** has scoped: `jobs.page` belongs to the
  jobs list, and handing it to another one would be worse than ignoring it. Set
  `readFlatFallback: false` to drop the compatibility now; it goes away on its
  own in a later version.

  Still consumed by nothing — `useListPage` is unchanged.

- ffc1579: The sort joins the seam — and stays exactly where it was

  The last of the five persistence sites moves behind `RouteStatePersister`.
  Nothing you can observe changes, and that is the decision, not an accident.

  Moving the sort to the URL was the tempting option: a list link would finally
  carry its ordering. It would also mean the sort no longer survives opening a
  clean `/offers`, which it always has — a gain nobody asked for against a loss
  every existing user would feel. So the default composition routes `sort` back
  to `sessionStorage`, per list, and the seam is worth having without buying it
  with that trade.

  What actually changed is the key: `qdadm_sort_offers` becomes
  `qdadm:offers:sort`. **A sort saved before the upgrade is still read** when
  the seam has nothing, and retired once carried over — the same migration
  rows-per-page got.

  The direction is stored only when there is a field to apply it to. An order on
  its own is not partial state, it is meaningless state, and it used to leave a
  `sortOrder` sitting in every unsorted list's namespace.

  `persistSort: false` still turns it all off.

  With this the table in `crud.md` finally describes a design rather than an
  accumulation: filters, search and page in the query string; rows-per-page in
  an app-wide cookie; sort in the session. One interface, three media, each
  chosen for a stated reason.

### Patch Changes

- a62e15c: A search term that looks like a number survives the round trip

  Found while a consumer was wiring their search box: their offers list is
  searched by **reference number**, and that turns out to be the case the URL
  round trip destroyed.

  Three parts, each silently dropping the term further along:

  **The persister coerced too eagerly.** `?level=42` coming back as the number
  42 is right — a query string is meant to be read by people. `'007'` coming
  back as 7 is not, and neither is a 19-digit id coming back as a float. The
  coercion now happens **only when it round-trips exactly**: if the number
  cannot be written back as the same text, the text was never a number. Order
  ids, invoices, phone numbers and reference prefixes all live in that gap.

  **`restoreFilters` required a string.** A term that _did_ survive the numeric
  round trip came back as a number and the guard dropped it, so the box
  reopened empty and the list unfiltered — a shared link showed the recipient
  something other than what the sender searched for.

  **`searchItems` ignored anything but a string**, returning the whole list
  untouched. So even a term that reached a storage as a number filtered nothing,
  without a word. Numbers now search; objects and booleans are still ignored,
  because there is no sensible text for them.

  ⚠️ **Behaviour change worth knowing:** a query parameter whose text cannot be
  reproduced from its number now stays a **string** where it used to become a
  lossy number. `?ref=007` gives `'007'`, not `7`. If you were relying on that
  coercion, you were relying on losing information — but check any `===`
  comparison against a number.

- 54d49ae: The search box actually searches

  Reported against the demo's todos list; it was every list with a search box
  over three of the five built-in storages.

  `search` has been part of `ListParams` since the beginning. **Three storages
  never read it.** `ApiStorage` dropped it before building the request,
  `MemoryStorage` and `SdkStorage` dropped it before filtering. A user typed, the
  list rebuilt its query, the term vanished, the rows came back unfiltered — and
  nothing anywhere said why. `LocalStorage` and `MockApiStorage` had always
  worked, which is what kept it hidden.

  The helper they all needed, `searchItems`, had existed since #1192. Two
  storages called it. This was not a missing capability; it was a missing call,
  in the places nobody checked.

  **`ApiStorage` now sends the term**, under whatever name your backend uses:

  ```js
  new ApiStorage({ endpoint: '/posts', paramMapping: { search: 'q' } })
  ```

  ⚠️ **Map it, or your backend gets a `search` parameter it has never heard
  of** — and an API that ignores an unknown parameter answers with everything,
  so the list looks exactly as broken as before. This is the one case where the
  fix can still leave you with the same symptom, so it is worth checking.

  `searchFields` deliberately stays on the front: it says which fields qdadm
  should look at when filtering a cached page locally, and a backend that
  searches knows its own columns. Shipping an array parameter nobody asked for
  would be a new surprise in place of the old one.

  `SdkStorage` both sends the term and applies it locally when
  `clientSidePagination` is on — otherwise an SDK that ignored it would hand
  back the whole collection and that branch would paginate it as though it had
  been searched.

- 40a7181: A filter type qdadm cannot render now says so — at compile time and at runtime

  Reported by a consumer who declared `type: 'text'` on two filters. `ListPage`
  is binary — an autocomplete, or a `Select` for everything else, unknown types
  included — so both rendered as dropdowns with no options, read **"No available
  options"**, and users concluded there was nothing to choose. They had never
  filtered anything since the day they were written.

  Two holes, and the second is larger than the report:

  **Nothing warned.** `addFilter` now does, naming the filter, the type, and
  what will happen _instead_ — because three screens later there is only an
  empty control and no way back to the declaration that caused it.

  **Nothing failed to compile either, and not just for `type`.** `addFilter`
  took `Omit<FilterConfig, 'name'>`; `FilterConfig` carries an index signature,
  so `keyof` includes `string`, `Exclude<string, 'name'>` is still `string`, and
  the `Omit` collapsed to a bare `{ [x: string]: unknown }` — **erasing every
  declared property**. No filter option was type-checked at all: not `type`, not
  `optionLabel`, not a misspelled `local_filter`.

  Fixed by splitting the interface — `FilterOptions` declares the properties,
  `FilterConfig extends FilterOptions` adds `name` — so nothing needs `Omit` and
  the index signature stops eating the declarations. Apps can still stash their
  own keys.

  **`FILTER_TYPES` is exported as a value**, so a guard on your side can read the
  list rather than copy it; a copy goes stale the day a type is added and starts
  rejecting correct code.

  Also new: `tsconfig.typetest.json`, because the type-level test that asserts
  all this sat under `tests/` and the type-check config included `src/**` only —
  so its `@ts-expect-error` directives were never read and it would have passed
  with the bug back in place. It is now in front of the checker and verified to
  go red when the collapse returns.

- 06565d3: The paginator shows the page the list is actually on

  #2113 put the page number in the URL and it worked — coming back from a
  detail view re-requested page 2, and page 2's rows appeared. **The paginator
  still highlighted 1.** The screen said "page 1" over page 2's rows, and the
  next click paged from the wrong place.

  In lazy mode the table renders exactly the rows it is handed and cannot infer
  which page they are; `first` — the row offset — is the only thing that tells
  it, and qdadm never passed one. Clicking through worked because the click
  moves the table's own internal offset. Nothing else could move it, so every
  restored page landed under a paginator stuck on 1.

  `ListPage` now takes a `first` prop and `useListPage` supplies it. **If you
  render your own table** from `list.props`, bind `:first` — a lazy table
  without it cannot position its paginator.

  The tests drive a real PrimeVue paginator and assert which page button is
  marked current, rather than checking `first === (page - 1) * pageSize`. That
  arithmetic is the thing under test; asserting it against itself is how the
  original defect got shipped — the rows were verified and the paginator was
  never looked at.

## 2.19.0

### Minor Changes

- c5765df: A misspelled config key now says so, starting where it costs most

  `sse` was the only configuration whose keys were checked. Every other one
  accepted anything in silence — including the top level, where the cost is
  highest: a misspelled key there does not degrade a feature, it removes a whole
  **section** of configuration. `securty:` means no security config at all, so
  every check falls through to its default and the app is open where its author
  believed it closed. TypeScript catches that; consumers whose module files are
  plain JavaScript get nothing.

  Unknown keys are now reported for `KernelOptions` and for `security`, in the
  shape #1898 established: the warning names what happens **instead**, because
  "ignored" reads as "no effect" rather than "falls back to something else".

  Suggestions got better in the process, and `sse` inherits it: the old matcher
  only caught case differences and prefixes, so `securty` suggested nothing at
  all. It now tolerates a missing, inserted, substituted or transposed letter.

  Deliberately **not** validated: `debugBar`, whose extra keys are forwarded to
  the DebugModule on purpose. A warning that cries wolf is worse than none, and
  this is not "validate everything" — see
  [ADR 0011](docs/adr/0011-no-silent-no-ops.md).

  The known-key list is compared against the `KernelOptions` interface by a
  test, so it cannot quietly fall behind and start warning about options that do
  work.

- 0bb730c: `./gen`'s runtime factory is renamed `createGeneratedManagers` — it collided with the root's own `createManagers`

  Two public entry points exported the same name for different functions. The
  root's `createManagers` takes `(config, context)` and returns a plain object;
  `./gen`'s took a single generated config and returned a `Map`. Whoever reached
  for the wrong import got no warning at all — the mistake surfaced at the first
  `.get()`, several frames from its cause.

  The documentation had absorbed the confusion too: `docs/gen.md` showed the
  ROOT's signature under the `./gen` import, and promised a `Record` where a
  `Map` comes back. Corrected.

  Nothing breaks: `createManagers` is still exported from `./gen` as a
  deprecated alias. New code should use `createGeneratedManagers`.

  This is the naming half of the problem only. `./gen` remains a source entry
  that Node cannot load on its own — splitting the build-time codegen from the
  runtime factory is a larger change with, so far, no one asking for it.

- b05d52c: One singularizer instead of two, and a navigation to a missing route now says so

  `crud()` NAMED routes with six hand-rolled lines while `EntityManager.routePrefix`
  LOOKED THEM UP through the vendored `pluralize`. Two engines, and they
  disagreed: `crud()` posted `people-show` while `useListPage` asked for
  `person-show`, so `router.hasRoute()` was false everywhere. No error at boot,
  nothing at all until someone clicked and the row simply did not open.

  They agreed on every regular plural — `books`, `categories`, `statuses`,
  `boxes`, `addresses` — which is precisely why it went unnoticed. `crud()` now
  uses the same engine as everything else.

  **Who this changes.** Only entities whose plural is irregular: `people`,
  `children`, `analyses`, `criteria`, `indices`, `men`, `feet`. For those, three
  derived values change, not one:

  | Derived from the entity name | Before        | After         |
  | ---------------------------- | ------------- | ------------- |
  | Route prefix                 | `people-show` | `person-show` |
  | Parent route param           | `peopleId`    | `personId`    |
  | Child foreign key            | `people_id`   | `person_id`   |

  The last one goes **on the wire** to your backend, so read it carefully if you
  have such an entity. An explicit `foreignKey`, `parentParam` or `routePrefix`
  still wins over the derived value, as before.

  An app with an irregular-plural entity cannot have been working without
  pinning something already — the two sides disagreed, so navigation was broken.
  If you pinned `routePrefix` on the EntityManager to match the old hand-rolled
  output, remove the pin or align both sides.

  **And the class of failure is no longer silent.** `goToShow`, `goToEdit` and
  `goToCreate` now warn, once per route name, when the name they are about to
  push does not exist — naming the name, the fact that nothing will happen, and
  the prefix they derived it from. The check sits at the moment of navigation
  rather than auditing prefixes upfront, because an entity that only ever
  appears as a child of another legitimately has no routes under its own prefix,
  and a warning nobody trusts is worse than none.

- ad6a6be: Five Kernel registries now exist the moment the Kernel does

  Seventeen public `Kernel` properties were `null` until `createApp()`, through
  a window nothing documented. Someone wired `kernel.signals` right after
  `new Kernel()`, got `null`, and `null?.emit?.()` swallowed it without a word.

  Five of them had no reason to wait — they depend on nothing but `options` and
  each other — and are now built in the constructor: `signals`, `hookRegistry`,
  `zoneRegistry`, `deferred`, `permissionRegistry`. Every creator is idempotent,
  so the calls still made during `createApp()` keep these instances rather than
  orphaning whatever was registered on them in between.

  **Their types drop `| null`.** That is the breaking part, and it is the point:
  the contract stops advertising a danger that no longer exists. Code written as
  `kernel.signals?.emit(...)` keeps working — optional chaining on a non-null
  value is merely redundant — but a consumer whose types said `SignalBus | null`
  and who branched on it will find that branch unreachable. `strictNullChecks`
  users may see narrowing they relied on disappear.

  Closing the window beats warning about it: this removes defensive code rather
  than adding any. `_setupSecurity` no longer rebuilds a registry that might be
  missing, and `_createDeferredRegistry` no longer reaches through `?.` for a
  bus that is always there.

  The properties that genuinely cannot exist before the app is mounted —
  `vueApp`, `router`, `moduleLoader`, `orchestrator` and the rest — are
  untouched. They are a different problem: the answer there is to refuse the
  read with a message naming the moment, not to fake a value.

- fef45ca: `vanilla-jsoneditor` is a real optional peer now — installing qdadm no longer drags in svelte

  Every consumer inherited three `npm audit` advisories they could not resolve,
  with **our package named** in their output, for a JSON editor most consoles
  never open. Measured on a clean install of the packed tarball: a consumer now
  gets no `vanilla-jsoneditor`, no `svelte`, and `npm audit` reports **0
  vulnerabilities**.

  Two declarations were wrong, in opposite directions:
  - `vanilla-jsoneditor` sat in `optionalDependencies`, which npm installs **by
    default** — "optional" there only means "do not fail the install if it
    cannot be fetched". Everyone got it.
  - It also had a `peerDependenciesMeta.optional` entry while not being a peer
    dependency at all, so the intent "optional peer" was written but never
    implemented.

  It is now an optional `peerDependency`, where that meta entry finally takes
  effect, matching the `/editors` subpath that was always opt-in.

  **BREAKING in practice.** An app that imports `@quazardous/qdadm/editors`
  without declaring `vanilla-jsoneditor` will fail to build after this upgrade.
  That is the correct behaviour — it was depending on something it never asked
  for — but it will not fail quietly:

  ```bash
  npm install -D vanilla-jsoneditor
  ```

  **The pin moves from `^0.23.0` to `^3.13.0`**, three majors on. That is what
  clears the advisories: 0.23 pulls svelte 4 and its six XSS notices, 3.13 pulls
  svelte 5 and is clean. The editor's own API changed with it —
  `new JSONEditor(...)` is deprecated in favour of `createJSONEditor(...)` — and
  qdadm's wrapper is migrated, so consumers using `VanillaJsonEditor` or
  `JsonStructuredField` see no difference. Consumers calling the library
  directly should read its 1.x/2.x/3.x notes.

  Also fixed while in there: `peerDependenciesMeta.sass-embedded.optional` was
  the **string** `"true"` rather than the boolean, so that optionality had never
  applied either.

- 343e387: `show` is a real layout now, instead of a name nothing could honour

  `crud({ show })` has always registered its detail route with
  `meta: { layout: 'show' }` — for a layout that existed nowhere. `LAYOUT_TYPES`
  knew four names and `show` was not among them; the Kernel built its layout map
  as a closed four-key literal, so a `layouts: { show }` an app passed was
  dropped without a word; and no name pattern could reach it either. The
  resolver returned `'show'`, found no component under that key, and fell back
  to `base` — gracefully, which is exactly what made it invisible. The only way
  to dress a detail page was to lie and declare it a form.

  `show` is now a layout like the others, reachable four ways: `meta.layout`, a
  `layouts: { show }` (or `ShowLayout`) on the kernel, a `*-show` route name, or
  a `*Show` component name. The last two matter more than they look: an app that
  declares its detail route by hand rather than through `crud({ show })` has no
  `meta.layout` to go on, and they are its only path.

  **Inert unless you ask for it.** With no `show` layout supplied, resolution
  reaches `'show'`, finds `null`, and falls back to `base` exactly as before. No
  existing page changes appearance. To use it, pass `layouts: { show }`.

### Patch Changes

- Updated dependencies [05a334c]
  - @quazardous/qdcore@1.2.0

## 2.18.0

### Minor Changes

- d2688d5: The debug bar can be switched off without a deploy, and can no longer take the app down

  **`?qddebug=off`** removes the bar for this browser and remembers it across
  reloads and redirects; `?qddebug=on` brings it back. It overrides even an
  explicit `enabled: true`. This is the piece a consumer most needed and did not
  have: when their bar took the admin down, the only way to stop it was to
  rebuild and redeploy.

  **An error boundary** now wraps whatever component `debugBar.component`
  provides. A bar that throws during render is dropped and the application keeps
  running, with the reason logged once. Until now the error propagated to the
  root and killed the app — a diagnostic tool failing precisely when someone
  needed it.

  The boundary catches thrown errors only; a runaway render loop throws nothing
  and is handled by the bar's own circuit breaker in `@quazardous/qddebug`, which
  ships in lockstep.

- a6ecd0a: List rows no longer wait behind filter dropdowns, and `filter:alter` moves ahead of them

  `onMounted` interleaved two different kinds of work. Settling **what the query
  asks for** — the filters, search and page restored from the URL, plus whatever
  the alter hooks add — and **fetching things**, which meant the filter options
  that populate dropdowns. The rows waited for both, though they depend only on
  the first. A list whose filters pull their options from related entities
  showed nothing until every one of those round trips had returned, for content
  nobody needs in order to read the table.

  The two are now separated. The query is settled first, the rows leave, and the
  dropdowns fill in on their own:

  ```
  restoreFilters()          // filters, search, page — from the URL
  await filter:alter        // whatever the hooks add
  await list:alter
  loadItems()               // the query is complete
  loadFilterOptions()       // not awaited
  ```

  **BREAKING for `filter:alter` hooks.** The hook used to run at the end of
  `loadFilterOptions()`, so it saw filters whose `options` were already
  populated. It now runs before that fetch, and sees them unpopulated. A hook
  that only adds, removes or reconfigures filters is unaffected; one that
  inspects or rewrites a filter's loaded `options` needs revisiting.

  `loadFilterOptions()` also fetches in parallel now rather than one filter at a
  time — three remote filters cost the slowest instead of the sum. Filters
  sharing one `optionsEntity` are still chained, so the second keeps reading the
  cache the first filled instead of racing it.

  Thanks to BookShepherd for the report, and for asking what `invokeListAlterHook`
  could change before proposing the reorder — that question is what showed the
  naive version was unsafe.

- 384d49c: The list's current page now lives in the URL

  It was the only piece of list state that survived nothing. Filters, search,
  sort and rows-per-page were all remembered; the page was not. So list → detail
  → back dropped the user on page 1 — on a large corpus that is not an
  inconvenience, it is losing your place — and a shared list link never showed
  what the sender was looking at.

  With `syncUrlParams` on (the default), the page is written to the URL once it
  leaves 1 and removed when it returns, so a pristine list still leaves a clean
  link. It is restored before the first request, not after, so there is no
  wasted round trip. Changing or clearing a filter resets it, since the results
  are renumbered.

  `page` and `search` are the URL sync's own keys. A filter named either now
  raises a one-off dev warning naming what happens instead: the list's own state
  wins and the filter will not survive a reload. The `search` collision has
  existed for as long as the URL sync has, silently — this is the first time it
  says anything.

  Two lists synchronising on one route will fight over `page`; an embedded list
  should set `syncUrlParams: false`, as `page-compositions.md` already advised
  for filters.

- 1fdf7c0: `ApiStorage` — the backend's pagination dialect is now configuration, not a subclass

  `paramMapping` reached the **filters only**. You could rename `status` to
  `state`, but not `page_size` to `limit`: `page`, `page_size`, `sort_by` and
  `sort_order` went onto the wire hard-coded. Any backend speaking another
  dialect — `_page`/`_limit`, `limit`/`offset` — had to override `list()` for
  that reason alone. Our own demo had done exactly that, fetching whole
  collections and slicing them client-side.

  `paramMapping` now covers the entire outgoing query:

  ```js
  new ApiStorage({
    endpoint: '/posts',
    paramMapping: { page: '_page', page_size: '_limit', sort_by: '_sort', sort_order: '_order' },
    responseTotalHeader: 'X-Total-Count',
  })
  ```

  New `responseTotalHeader` reads the total from a response **header**, for APIs
  that report it there rather than in the body (`responseTotalKey` still handles
  the body, and remains the fallback). A genuine `0` from the header is kept; the
  header must be CORS-exposed to be readable from a browser.

  Filters keep precedence over the pagination keys, exactly as before: a filter
  named `page` still wins.

  **Worth checking before you upgrade:** if you already pass a `paramMapping`
  whose keys happen to include `page`, `page_size`, `sort_by` or `sort_order`,
  those entries did nothing until now and will start renaming your pagination
  parameters.

### Patch Changes

- 1fdf7c0: Docs: `syncUrlParams` does not sync the sort, and the demo now paginates for real

  `docs/crud.md` described `syncUrlParams` as "Sync filters/sort with URL". The
  sort never reaches the URL — `onSort` writes to the session and nothing else.
  The line described an intention rather than the code, and a consumer who
  trusted it concluded the URL carried more state than it does.

  The documentation now states where each piece of list state actually lives
  (URL, session, or nowhere).

- Updated dependencies [d2688d5]
  - @quazardous/qddebug@1.2.0

## 2.17.4

### Patch Changes

- 749128f: `debugBar: { enabled: false }` now actually disables the debug bar

  The flag was inert in both halves of the path: the bar component was
  registered whatever `enabled` said, and passing `debugBar` at all forced
  `options.debug = true`, which `DebugModule.enabled()` reads as "turn on". A
  consumer who wrote `enabled: false` to switch the bar off shipped it to
  **production**; the only working workaround was to omit the key entirely.

  `enabled` is now effective in **both directions**, which cuts both ways: an app
  that passed `enabled: false` believing the key inert — including one that left
  it there to keep the bar visible, since it changed nothing — will now see the
  bar disappear. Both readings were possible precisely because the flag did
  nothing. Remove the key (or set `enabled: true`) to keep the bar.

  Disabling the bar no longer forces debug mode on, and an explicit
  `debug: true` alongside a disabled bar is left alone.

## 2.17.3

### Patch Changes

- b50c966: Expired sessions are detected whatever the transport, and handled once (#1905, from a consumer incident). `auth:expired` was emitted only by the kernel's axios interceptor, so an app using `SdkStorage` with its own fetch-based client never detected expiry at all — the screen kept requesting with a dead token and stacked one error toast per attempt. `EntityManager` now announces a 401 from any storage call, which covers `ApiStorage`, `MockApiStorage`, `SdkStorage` and custom adapters alike. The handler runs **once per session**: it logs out, emits `auth:logout` — which remounts the app — and redirects, so a page firing four requests that all 401 used to do that four times; the guard re-arms on the next `auth:login` and does not read your auth state, so emitting after clearing your own session still redirects. The axios interceptor no longer treats a **403** as an expired session: a 403 says the session is valid and this door is closed, and logging the user out sent them to sign in again for a permission they would not have afterwards — a loop, not an error; permission refusals stay `api:error`. Finally, `kernel.signals` is available from construction instead of `null` until `createApp()`, since wiring it right after `new Kernel()` is the natural place and `null?.emit?.()` fails silently.

## 2.17.2

### Patch Changes

- 2d8ebc6: The SSE stream now connects for a restored session, survives a second login, keeps the token out of the logs, and says when a config key is ignored (#1898, from a consumer's production incident). Four fixes that composed into one symptom — the stream only ever connected on a _fresh interactive login_, never on a reload nor after logging in again. `connectOnSignal` was a `once()` while `disconnectOnSignal` was an `on()`, so a second login reconnected nothing; it is now symmetric, and ignores the signal while already connected. A session restored from storage connects the stream at boot: `auth:login` is emitted by the login _page_, so a reload — which never renders it — left the stream dead. The bridge redacts the value of `tokenParam` before logging a URL, since that option exists precisely to carry a secret and any error reporter capturing logs would outlive the session with it. And an unrecognised `sse` key now warns in dev naming **what happens instead** — an unknown `getToken` means the durable session token goes into the stream URL, which is how the incident happened: "ignored" reads as "no effect", not as "falls back to a more sensitive secret".
- Updated dependencies [2d8ebc6]
  - @quazardous/qdcore@1.1.2

## 2.17.1

### Patch Changes

- 5c5c1e2: Fix: the built entry points exist after a plain `npm install`, not only after `npm pack`. Pointing `exports` at `dist/` (#1895) paired it with a `prepack` hook, which npm runs when packing or publishing — but not on install. A workspace link or a `file:` dependency therefore had no `dist/`, and any bundler resolving `@quazardous/qdadm/vite` or `@quazardous/qdadm-mcp` failed with "Failed to resolve entry for package". The hook is now `prepare`, which npm runs on install _and_ before pack and publish, so every consumption path gets the build.
- Updated dependencies [d1c5235]
  - @quazardous/qdcore@1.1.1

## 2.17.0

### Minor Changes

- 6762a83: Google sign-in facilitator, authorization-code + PKCE (#1775). `GoogleOAuthAdapter` builds the authorize URL with an S256 challenge, remembers where the user was heading, validates `state` on the way back, and hands the code to **your** backend — which redeems it with the client secret and issues its own session. qdadm never validates a Google credential in the browser: there is deliberately no code path from a provider response to a session without your backend, because decoding a JWT client-side proves nothing. The backend contract is an open HTTP shape (`POST` → `{ token, user }`), so `new GoogleOAuthAdapter({ clientId, exchangeUrl })` is enough and an app with a Python or Go backend writes no adapter code at all; override `exchange()` only for a non-standard endpoint. Ships with `OAuthCallbackPage` — register it on a **public** route, since the router sends unauthenticated visitors to the login page and the callback arrives before the session exists — and an `#alternatives` slot on `LoginPage`, between the form and the footer, which is where users look for SSO buttons. Marked `@experimental`.

## 2.16.1

### Patch Changes

- f61586b: Fix: the vite plugins can be imported from a real npm install (#1895, BookShepherd report). `exports["./vite"]`, `"./vite-plugin-debug"` and `"./gen/vite-plugin"` pointed at raw `.ts`, and Node refuses to strip types under `node_modules` — so any `vite.config.js` importing `qdadmVitePlugin` died with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, taking `npm run dev` and `npm run build` with it, on an error that never named qdadm. It never showed here because our examples consume through a workspace symlink, whose realpath escapes `node_modules`. Those three entry points are now compiled to `dist/node/` and built by `prepack`; everything the consumer's bundler compiles still ships as source, so raw-source consumption is unchanged. The consumer-smoke gate now imports every Node entry point for real and asks vite to resolve a config using the plugins — the previous gate typechecked the packed tarball without ever loading it, which is exactly how this shipped. `@quazardous/qdadm/gen` remains source-only and still cannot be imported from Node: it mixes build-time codegen with a runtime factory that instantiates an `EntityManager`, and splitting it changes a published entry point.

## 2.16.0

### Minor Changes

- 5588600: Fix a runaway reactivity loop that could kill a page in dev (#1896, BookShepherd report). A snapshot resolved i18n labels; resolving a _missing_ key emits `i18n:missing`; that signal was recorded by two collectors, each notified, and each notification bumped the tick the snapshot pusher watches — one tick produced fourteen, and a consumer measured ~8000 ticks/s until the page died. Three changes, in increasing order of generality. `i18n:missing` is now announced **once per key and locale** rather than on every resolution — a missing key is a fact, and one signal carries its whole diagnostic value (the cap resets when the locale changes or a bundle loads, since the fact may no longer hold). The debug bridge treats `describe()` and `dump()` as reads: a collector that notifies while being observed no longer bumps the tick, which closes the class rather than this instance. And `notify()` now coalesces to at most one tick per frame, so any loop that still gets through costs a measurable slowdown instead of a dead page — `notifySync()` keeps the immediate path for callers that need it.

### Patch Changes

- Updated dependencies [5588600]
  - @quazardous/qddebug@1.1.0

## 2.15.0

### Minor Changes

- 8619a4e: Per-entity punchline: new optional `description` on `EntityManager` — a one-liner explaining what the entity is, rendered as a muted subtitle under the list page title. `useListPage` picks it up automatically; override per page with the `subtitle` option (`null` suppresses it).
- dd100d7: Declare which entities your backend writes out of session, and qdadm routes its events to the right cache (#1888 lot C, reported in #1887). `sse: { entities: ['runs', 'jobs'] }` — or `true` / `'*'` for all — makes the stream's `entity:{created,updated,deleted}` frames (`data: {"entity": "runs", "id": 42}`) invalidate that entity's cache; the frame names are registered for you. Undeclared entities are ignored, since a stream carries more than entity mutations, with a one-off dev warning per entity so a dropped frame is never silent. The routing runs inside the front's security scope: an event for an entity the current user cannot read is dropped rather than refetched. `LiveEntityRouter` is transport-agnostic — its `notify(entity, action, id)` entry point takes a plain fact, so a WebSocket or a `BroadcastChannel` between two tabs attaches the same way SSE does.
- a22f012: A screen showing a live entity now follows changes made outside the session (#1888 lot D, reported in #1887). Invalidating marks a cache stale but repaints nothing, so a list already on screen kept its rows until the user navigated away and back — precisely the case a pushing backend exists for. `useListPage` and `useEntityItemShowPage` now reload themselves, with no page-level opt-in to forget: the gate is upstream, since only an entity declared in `sse.entities` ever produces a remote event. Each entity carries its own policy, pre-wired and overridable — `live: { refresh: 'mounted' | false, coalesceMs: 300 }` on the `EntityManager`, so a heavy `logs` list can drop its stale cache without refetching while `runs` refreshes on sight. A burst of events collapses into one reload; a detail page only reacts to its own record; and a list refreshing under someone mid-bulk-action keeps their selection, re-matched by key.
- 534512e: Remote changes now invalidate the list cache (#1888 lot B, reported in #1887). `entity:data-invalidate` carries a `source` marker, and an `EntityManager` receiving `source: 'remote'` for its own entity drops its list cache. Until now no subscriber cleared it: the parent-entity handler only fires for an entity's _parents_, and the own-entity handler is gated on asymmetric mode and only touched the detail cache — so an ordinary entity received nothing, and an app emitting the canonical signal kept serving a stale list while believing it had invalidated everything. Local mutations emit `source: 'local'` and are ignored by that handler, since the manager that mutated has already repaired its own cache: writes cost no extra refetch.
- e910984: SSE: the auth token may now be fetched asynchronously, and the kernel `sse` config can supply it (#1888 lot A, BookShepherd report #1887). `EventSource` accepts no headers, so the token rides in the query string and lands in access logs — apps that refuse to leak a durable credential there can now serve a short-lived, single-use ticket instead: `getToken` accepts `() => string | null | Promise<string | null>`, awaited before each connect. `SSEConfig` gains `getToken` (an explicit `null` sends no token at all), plus `connectOnSignal` / `disconnectOnSignal` passthrough — without them the async token was unreachable for anyone using the kernel's `sse` config rather than building an `SSEBridge` by hand. Purely additive: synchronous `getToken` implementations keep working unchanged. A connect that awaited its token now checks it has not been superseded before opening the connection, so a `disconnect()` or a second `connect()` during the fetch no longer resurrects a torn-down stream.
- 4a04f4d: Vendor `pluralize` as an internal ESM module and drop it from dependencies (#1454). qdadm no longer has any CJS transitive, so `qdadmVitePlugin` stops emitting `optimizeDeps.include` entirely — this fixes the unresolvable `pluralize` optimizer error for `file:`-linked consumers (npm `install-links=false`), where qdadm's deps are never installed at the consumer root. Consumers that added `pluralize` as a direct-dependency workaround can remove it.

### Patch Changes

- a87ee80: Declare which parts of the API are stable and which are still moving (#1029). New `docs/API_STABILITY.md` defines three tiers operationally — **stable** is what the CI-enforced consumer-smoke fixture and the tutorial exercise, **supported** is documented and demo-exercised, **experimental** is marked in the source — and says what breaking each one costs. Five module entry points now carry `@experimental` JSDoc, visible in editor tooltips: `chain/`, `deferred/`, `query/` (the executor classes only — the query object syntax is stable), `kernel/SSEBridge`, and `gen/vite-plugin`. Annotations and docs only; no API change.
- 2fbdaab: Fix: a live event naming an entity with no registered manager is dropped instead of throwing (#1888). `Orchestrator.get()` raises on an unknown name by design — to catch developer typos loudly — so the live router now checks `has()` first. A typo in `sse.entities`, or an entity whose module is lazily loaded, would otherwise have raised inside the signal bus on every frame the backend sent.
- c2946e6: Declare `sass-embedded` as an optional peerDependency and add it to every quick-start install line (#1514, aihoku feedback). qdadm ships raw `.scss` styles, so Vite consumers need a sass compiler — the requirement is now visible in metadata and docs instead of surfacing as a `Preprocessor dependency "sass-embedded" not found` overlay on first boot.
- Updated dependencies [e910984]
  - @quazardous/qdcore@1.1.0

## 2.14.0

### Minor Changes

- 516a440: Debug plugin: inter-plugin broker api + typed page-side queries (#1398)

  `qdadmDebugPlugin` exposes its ws broker through the standard Vite plugin
  `api` (consumed by @quazardous/qdadm-mcp), and the injected client gains
  typed, bridge-independent handlers: sessionInfo, routes, entityState,
  entityCall, storageDump, recentSignals, and a boot log buffered from
  BEFORE the app boots (console/page errors visible even when the app dies
  pre-bridge). Unknown subpaths under /\_\_qdadm now fall through so sibling
  plugins can mount their own endpoints.

### Patch Changes

- decf3fc: QdButton / QdMessage wrappers (#1391): the framework's 24 raw
  primevue/button and primevue/message imports now go through two thin
  pass-through components (components/base/, exported), concentrating any
  future widget-library divergence into two files. An ESLint
  no-restricted-imports guard keeps raw imports from creeping back.
  Zero visual or behavioral change; flavor-compatible by construction.

## 2.13.0

### Minor Changes

- 910a7c2: Path-addressable dirty detection (#1396): `isFieldDirty('config.login')`
  tracks sub-fields of JSON objects like root fields — `FormField` accepts
  dot paths in `name` with zero changes, dot-free names keep the exact
  previous behavior. Kills the flatten-and-repack pattern for pages editing
  nested objects.
- d60b123: qdadmVitePlugin `primevue` flavor option (#1393): alias every `primevue/*`
  import to a compatible fork (e.g. `openvue`) from the consumer config —
  qdadm officially tests primevue@4 only, other flavors are the consumer's
  adaptation. `primevue` peer is now optional so flavor-only installs don't
  fight npm.

## 2.12.0

### Minor Changes

- d0ceb97: MockApiStorage accepts a `storageKey` option to override the default
  `mockapi_<entityName>_data` localStorage key — several apps sharing one
  origin (e.g. multiple demos on a GitHub Pages site) can now seed the same
  entity names without clobbering each other.

### Patch Changes

- 6798731: qdadmVitePlugin picks ONE CJS-transitive include form per install mode
  (nested for npm installs, plain for symlinked) instead of declaring both —
  kills the cosmetic "Failed to resolve dependency" optimizer warning
  (skybot testbed feedback).

## 2.11.0

### Minor Changes

- 35a3411: New `qdadmVitePlugin()` export at `@quazardous/qdadm/vite` (#1385)

  One line in the consumer's `vite.config.ts` replaces the hand-written
  `resolve.dedupe` + `optimizeDeps` block that npm-installed qdadm needed to
  avoid the dual-PrimeVue instance split (`Error: No PrimeVue Toast provided!`
  blank page in dev). Covers both the npm-install and `file:`/workspace-link
  scenarios. The package README's misleading claim that npm installs were
  unaffected is corrected.

### Patch Changes

- ad1069d: Published sources now pass a strict consumer typecheck out of the box (#1386)
  - Removed the write-only private fields and unused v-for alias that failed
    `noUnusedLocals` in consumer builds (create-vite vue-ts template flags),
    including `EntityRolesProvider._ctx` (caught once the smoke fixture gained
    the `/security` subpath import).
  - `@types/pluralize` moved into dependencies — consumers no longer shim it.
  - `@quazardous/qdadm/styles` gained a `types` exports condition + d.ts
    companion, so the side-effect import typechecks (was TS2882).
  - The consumer-smoke CI gate now runs with the vue-ts template's strict
    flags (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
    `erasableSyntaxOnly`) and no local shims, so this can't regress.

- 05edc80: DX polish pack from the onboarding audit (#1388)
  - SecurityChecker warns (once per role) when a user's role matches no
    configured role — the "role: admin instead of ROLE_ADMIN → silently zero
    permissions" trap is now debuggable.
  - Kernel warns at boot when `security` is configured without
    `entityAuthAdapter` (permission checks silently permissive).
  - No-auth apps no longer log `injection "authAdapter" not found` on every
    page (inject defaults in useAuth).
  - Number fields accept `useGrouping: false` to disable locale digit
    grouping in show displays (years render as 1965, not "1 965").
  - Sidebar user zone prettifies unmapped ROLE\_\* constants
    (ROLE_SUPER_USER → "Super User").
  - `examples/hello-world` rewritten on the canonical Kernel bootstrap
    (drops the legacy createQdadm path, toast stub and stale
    @primevue/themes import; dogfoods qdadmVitePlugin).
  - Sibling navlinks only forward the route params their target declares —
    silences vue-router's "Discarded invalid param(s)" warning on child
    item pages.

- 0fdb5e6: Shipped types now match the documented patterns — no more `as any` in a
  strict TS consumer (#1387)
  - `KernelOptions.authAdapter` accepts session-adapter subclasses (removed
    the index signature that rejected class instances).
  - `entityAuthAdapter` accepts the documented function form
    (`() => authAdapter.getUser()`).
  - `ChildConfig` gains `foreignKey` / `label` (the README parent-child shape).
  - `FormInput` accepts generated fields (`ResolvedFieldConfig`) and binds
    v-model over `Record<string, unknown>` indexes; `ShowField.value` accepts
    arbitrary values.
  - `useEntityItemShowPage` data defaults to `Record<string, unknown>`;
    `parentData` is a typed record (property access works).
  - The tutorial patterns are now a cast-free type-conformance fixture inside
    the consumer-smoke CI gate — docs and types can no longer drift apart.

## 2.10.0

### Minor Changes

- aa5c366: Support vue-router 5 and pinia 4 (#1384)
  - Peer ranges widened: `vue-router: ^4 || ^5`, `pinia: ^2 || ^3 || ^4` — a plain
    `npm install @quazardous/qdadm vue-router pinia` no longer hits ERESOLVE with
    npm's current latest. Compatibility verified end-to-end (build, routing, auth
    guard, child routes) against vue-router 5.2 / pinia 4.0.
  - Kernel auth guard migrated from the deprecated `next()` callback to
    return-style navigation guards (vue-router 4 compatible, silences the
    `VUE_ROUTER_R0025` deprecation on vue-router 5).
  - Sidebar version badge no longer renders a dangling `v` chip when
    `app.version` is not configured (#1382 audit).

## 2.9.0

### Minor Changes

- Navigation train: shared NavlinksGroup + breadcrumb fixes
  - New exported `NavlinksGroup` component (#1357): single rendering of the
    mode-links + navlinks group used by AppLayout's inline breadcrumb and
    DefaultBreadcrumb. Dedups navlinks whose target route a shown mode link
    already covers — the auto "Details" link no longer renders next to an
    identical "Edit" mode link on child pages. "Details" label now resolves
    through i18n (`breadcrumb.details`, fallback "Details").
  - Create pages keep their entity-list crumb (#1356): `/books/create` renders
    `Dashboard > Books > Create` (Books linked) instead of `Dashboard > Create`.
  - Package README doc links are absolute GitHub URLs so they work on
    npmjs.com; `repository.directory` added (#1358).

## 2.8.0

### Minor Changes

- e967100: Mode links on child-list pages (#1353): `useNavContext` gains `modeLinks` — the uniform list the breadcrumb components render at the end of the navlinks group. Item pages keep the single opposite-mode entry (unchanged behavior, `modeToggle` preserved for compatibility); child pages (routes with `meta.parent`) now surface the PARENT item's `View | Edit` pair, each under the same route-existence/`canUpdate`/i18n rules.

## 2.7.3

### Patch Changes

- 380e897: Sidebar select overlays no longer get painted over by the next sidebar box (#1352): every `.sidebar-box` is its own stacking context (`z-index: 1`), so an open overlay (`appendTo="self"`, z 1001) was trapped inside its box's context and later sibling boxes painted over it — the "transparent dropdown" symptom. `.sidebar-box:focus-within` now raises the whole box (`z-index: 20`) while its control is open.

## 2.7.2

### Patch Changes

- 1652d02: The breadcrumb View↔Edit toggle now renders in the right-side navlinks block (with the Details/child links) instead of trailing the breadcrumb, as a plain text link — no default icons (#1341 follow-up).

## 2.7.1

### Patch Changes

- 5733042: AppLayout's inline breadcrumb now renders the View↔Edit mode toggle (#1341): the `breadcrumbModeToggle` flag shipped in 2.7.0 was wired only in DefaultBreadcrumb, leaving it inert for AppLayout consumers — the default layout now honors the same opt-in contract.
- 5733042: Show field resolver crashed on canonical object-form references: `generateFields()` passed `reference: { entity }` straight to `orchestrator.get()`, throwing `No manager for entity "[object Object]"` and blanking the show page. The resolver now normalizes both forms (object and bare string) and probes `orchestrator.has()` before resolving.

## 2.7.0

### Minor Changes

- 8386de8: Declarative View↔Edit navigation on entity pages (#1332): `useNavContext` exposes a `modeToggle` computed (twin-mode route resolved from the semantic breadcrumb terminal, `router.hasRoute`-checked, `canUpdate`-gated on the Edit side, locale-reactive labels via `breadcrumb.view` / `breadcrumb.edit` keys), and `DefaultBreadcrumb` renders it as a toggle next to the terminal crumb — opt-in via `qdadmFeatures.breadcrumbModeToggle: true`. Edit→show navigation stays covered by the form page's own unsaved-changes guard.

### Patch Changes

- 550d23a: Two types consumers could not satisfy without casts (#1281): `ctx.entity()` is now generic (`entity<T extends EntityRecord>`) so narrowed `EntityManager<T>` subclasses pass (the invariant `EntityManager<EntityRecord>` parameter rejected them); `ResolvedAction` has a single declaration — `ShowPage` imports the composable's type instead of redeclaring it, and `severity` is typed `ButtonSeverity` (now exported from the main barrel) across `ActionConfig`, `LazyActionConfig` and show badges, so `v-bind="show.props.value"` typechecks.
- eacb435: JsonStructuredField.jsonMode now accepts string literals ('tree' | 'text' | 'table') like its VanillaJsonEditor sibling — consumers no longer need to import the vanilla-jsoneditor Mode enum (#1280, mirror of #1253).

## 2.6.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @quazardous/qdcore@1.0.0
  - @quazardous/qddebug@1.0.0

## 2.6.0

### Minor Changes

- f2a7e08: Column header shadowing made loud + consistent (#1255). When an i18n key
  `entities.{entity}.fields.{field}` shadows an explicit header (per-call
  `column()` override or inline `addColumn` header) with a DIFFERENT value, a
  one-shot dev warning announces it (deduped per entity+field; silent when the
  key merely copies the header). The precedence itself is unchanged and now
  documented where it lives: the catalog wins by design — an inline `header`
  is the no-key fallback, not an absolute override; to pin a header, don't
  create the key.

  Consistency fix uncovered by the warning's tests: `addColumn` used to let
  the inline header win at registration and only flip to the i18n value on the
  first locale change — silently and inconsistently. The catalog now wins at
  registration too.

- 01233b5: Structural views tightened + exported (#1253 phase 2). `query`,
  `invalidateCache`, `getFieldConfig` and `canRead` are now REQUIRED on the
  `EntityManagerRead` / `EntityManagerPermissions` views — they are
  unconditionally implemented on `EntityManager` and called unguarded by list
  pages; the `?` was a #1191 unification leftover that forced consumer-side
  casts on base methods (`.manager.invalidateCache()` no longer needs one).
  The badge/severity capability (`getEntityBadges`, `hasSeverityMap`,
  `getSeverity`, `getSeverityDescriptor`) stays optional by design, documented
  as such. Optionality contract documented in the interface header: required
  iff qdadm composables call it unguarded, plus capability coherence.

  The views are now exported from the main barrel (`EntityManagerBase`,
  `EntityManagerPermissions`, `EntityManagerRead`, `EntityManagerCrud`,
  `EntityManagerLike`, `OrchestratorLike`) so consumers can type manager-likes
  and test doubles against the same contract.

  Type-only tightening: hand-rolled manager-likes missing the flipped members
  stop compiling (they were one call away from a runtime crash inside list
  pages). No runtime change.

## 2.5.0

### Minor Changes

- 6083daf: OpenAPIConnector now warns on contract-less object schemas (#1240). A consumed
  `type: 'object'` node with no `properties`, no `additionalProperties` and no
  `$ref`/`oneOf`/`anyOf`/`allOf` emits an `EMPTY_OBJECT_SCHEMA` `ParseWarning` —
  under Fastify (fast-json-stringify) such a field serializes to `{}` at runtime,
  stripping every key. `parse()` now logs collected warnings via `console.warn`
  so CLI/vite-plugin users see them without switching to `parseWithWarnings()`;
  the structured API is unchanged. Generated output is untouched (object fields
  already emit `Record<string, unknown>`).
- 5593ef2: List column binding + OpenAPI field enrichment (#1255):
  - **`column(name, overrides?)`** on `useListPage` — spread onto a PrimeVue
    `<Column v-bind="list.column('botUuid')">` to derive `field` + `header`
    from one source while keeping the `#body` template. Header resolution:
    i18n key > override > inline `addColumn` header > `manager.fields[].label`
    > humanized field name. Pure read, additive — explicit `#columns` slots
    > and `addColumn` are untouched.
  - **`OpenAPIConnector` opt-in `inferLabels: 'humanize'`** — emit a humanized
    label (`botUuid` → "Bot Uuid") when a field has no `description`.
  - **`OpenAPIConnector` opt-in `inferReadOnly: true`** — fields present in
    responses but in no request-body schema become `readOnly: true` (entities
    without write operations get all fields readOnly); schema-declared
    `readOnly` always wins.
  - New `humanizeFieldName` util exported from `@quazardous/qdadm/utils`.

  Both connector options are off by default: enabling them changes generated
  manager output (by design — regen and commit under your drift gate).

- a78429b: Four TypeScript consumer-experience fixes (#1253):
  - **`QdadmManagerRegistry`** — consumer-augmentable interface (vue-router
    `RouteNamedMap` pattern). Declare your entity-name → manager-subclass map
    once via `declare module '@quazardous/qdadm'` and `getManager('bots')` /
    `useEntity('bots')` return the concrete subclass; unregistered names keep
    the historical `EntityManager<T>` fallback.
  - **`StorageResolution` / `ResolvedStorage` exported** from the main barrel —
    typing a `resolveStorage()` override no longer needs `ReturnType<...>`
    archaeology. (`undefined` was already legal in the union.)
  - **`baseClass` option in `generateManagers`** — global or per-entity
    `{ import, name }`; generated managers extend (classMode) or instantiate
    (instance mode) your own EntityManager subclass instead of the hardwired
    `EntityManager`.
  - **`VanillaJsonEditor.mode`** accepts `'tree' | 'text' | 'table'` string
    literals (the JSDoc example finally typechecks); the `Mode` enum is also
    re-exported from `@quazardous/qdadm/editors`.

## 2.4.5

### Patch Changes

- 25d839d: Type-safety / legacy cleanup (#1196, KPI-9 Phase A). `SecurityChecker`'s parallel legacy branch is retired: `rolePermissions`/`roleHierarchy` constructor options are normalized once into a `StaticRoleProvider` (a passed `RoleHierarchy` instance now contributes its config to the provider instead of living in a shadow field) — the config surface is unchanged and back-compat is test-locked. New public `hasSecurityChecker()` on `EntityAuthAdapter`; `EntityManager` no longer reaches into the private `_securityChecker` field through a cast. Phase B **complete**: all 13 kernel split files converted from `type Self = any` to their real prototype shapes (`Kernel`/`KernelContext`) — with the 4 entity files already on `EntityManagerInternal`, **all 17 prototype-patched files are now this-typed**. The typing immediately caught real drift: the #1201 options `parentParamMode`/`routeParamResolver` were missing from the KernelContext-side `KernelOptions` view — now declared.

## 2.4.4

### Patch Changes

- ef158ec: Dirty-tracking perf (#1194, KPI-7). `checkDirty` runs on every keystroke (deep watch on the form): the initial-side per-key `JSON.stringify` is now precomputed once at `takeSnapshot()` (cached map) instead of re-stringified on each check, and the snapshot's `JSON.parse(JSON.stringify(state))` deep clone is gone. Measured on a 100-field form with nested values: **checkDirty ×1.6 faster per keystroke, takeSnapshot ×1.85 faster**. Behavior identical (locked by a new dedicated test suite — `useDirtyState` previously had no direct tests); `isFieldDirty` reactivity untouched.
- 9ff8267: Split `useListPage.ts` (#1195, KPI-8): the two self-contained subsystems are extracted into composables it composes back in — `useListFilters` (filter state, the three option-source modes optionsEntity/optionsEndpoint/optionsFromCache, session persistence, URL sync, registry auto-load) and `useListAlterHooks` (`list:alter`/`filter:alter` wiring). Pure mechanical extraction: the public surface is unchanged and the existing useListPage tests pass untouched; the file drops from 1557 to ~1200 lines and both subsystems now have focused unit tests. `QueryOrchestratorLike` is now exported from FilterQuery.

## 2.4.3

### Patch Changes

- 75785de: Null placement in local sorts is now **configurable** (#1222) — it depends on the API and the field semantics. New `nullSort: 'first' | 'last' | 'low' | 'high'` accepted at three levels: per **field** (`fields.lastSeen.nullSort`), per **manager** (`nullSort` option, default for all fields), and on the shared `sortItems(items, by, order, { nulls })` helper. Default stays `'last'` (the 2.4.1 behavior — nulls at the end both ways). Use `'low'` for "last seen"-style dates: "Never" then sorts beyond the oldest period (first in asc, last in desc — PrimeVue `nullSortOrder: -1` semantics). `nullSortRank` and the types are exported.

## 2.4.2

### Patch Changes

- ca7ed56: Fix sort toggling on lists (#1222) — four stacked defects made inverting a sort a visual no-op:
  1. **Ghost loading mask**: near-synchronous loads (cache/local storage, fast APIs) flipped `loading` true→false within one frame, interrupting the PrimeVue overlay-mask transition — the invisible mask stayed in the DOM and swallowed every subsequent header click. The loading indicator is now **delayed 150 ms** (no spinner flash on fast loads, unchanged on slow ones).
  2. **removableSort's "sort removed" state** (PrimeVue cycles asc → desc → removed) reached the composable as `sortField: ''` / `sortOrder: 1`, loading unsorted; on the cache path this re-served the cache in whatever order the previous sort left it — identical rows. Removed-state now **falls back to the list's `defaultSort`**, and the null mapping is honest end-to-end.
  3. **Cache mutation**: the local sort reordered `cache.items` in place, so later unsorted reads returned the last sort's order. The sort now copies first.
  4. Session sort entries with an empty field (artifact of 2) are rejected on read.

  Also fixes the demo countries storage silently ignoring `sort_by`/`sort_order` (inherited from the dead REST Countries contract), and actually exports the KPI-5 `clientFilter` helpers (`sortItems`/`filterItems`/`searchItems`/`paginate`/`defaultGenerateId`) — the 2.3.1 changeset promised them but the barrel entry was missing.

- f8b424f: Dedup the page/composable copy-paste clusters (#1193, KPI-6). New shared units: `CardShell` (conditional Card wrapper — ShowPage and FormPage no longer duplicate their entire content body per branch), `useActionRegistry<A, Ctx, R>` (the map + ordered add/remove/resolve skeleton behind the list/form/show action registries; per-page resolution stays local), `createOrchestratorToast()` (was verbatim ×3), `runFieldValidators` (required → type → custom pipeline shared by validateField/validate), `formatFetchError` (utils). `useListPage`/`useEntityItemPage` now use the canonical `useOrchestrator()` injection (same error message). Also: `editRouteSuffix` option is now honored in the create→edit redirect, small dead code removed. Pure refactor, zero behavior change.

## 2.4.1

### Patch Changes

- 3a9e266: Local sort (cache path used by `useListPage`/`query()`) now places `null` values **last in both directions** (#1221). The previous direction-aware placement put nulls first on `desc` — a "Last Seen desc" list showed the never-seen rows on top. Aligns with the storage adapters' shared comparator. Note for lazy/server-paginated lists: the network request skybot captured (`limit=100`, no sort) is the #1204 cache-fill, which legitimately fetches everything unsorted — ordering happens in this local sort; `loadItems` does send `sort_by`/`sort_order` on real server-side fetches.

## 2.4.0

### Minor Changes

- 63f1db2: `useListPage` now persists the active sort (`sortField`/`sortOrder`) per entity, on the same session mechanism as filters, and restores it on init with `defaultSort` as fallback (#1218). Sorting a list, navigating to a detail and coming back no longer resets the order. Opt-out with `persistSort: false` (symmetric to `persistFilters`).

## 2.3.1

### Patch Changes

- 8ac586b: Dedup the client-side list pipeline across storage adapters (#1192, KPI-5). The byte-identical sort/search/paginate blocks in MemoryStorage, LocalStorage, MockApiStorage and SdkStorage now live in one shared `query/clientFilter.ts` (`sortItems` / `filterItems` / `searchItems` / `paginate` / `defaultGenerateId` — new public exports). Filtering keeps its historical per-adapter semantics via an explicit `stringMatch` mode (`includes` for Memory/Sdk, `exact` for Local); MockApiStorage keeps delegating operator filters to QueryExecutor. `StorageError` moved to `storage/errors.ts` (still re-exported from MemoryStorage and the storage barrel — no import breaks). The triplicated `generateId` default loses its deprecated `String.substr`. Pure behavior-preserving refactor.

## 2.3.0

### Minor Changes

- c039920: `ListPage` and `DefaultTable` accept a new `tableProps` prop, forwarded verbatim to the underlying PrimeVue `DataTable` and bound last so it can override defaults (#1217). Unlocks every DataTable prop qdadm doesn't wrap explicitly — e.g. `:table-props="{ nullSortOrder: -1 }"` to sort `null` values last ("Never"-style date columns) without leaking a display concern into the API payload.

## 2.2.2

### Patch Changes

- ee576ee: `PageNav` no longer builds navlinks that vue-router rejects (#1205). On a child family with a show route (`jobs/:jobId/tasks/:id`), the sibling/children navlink builders passed only the currently-available params, so `useLink` threw `Missing required param "id"` on every list/detail view (non-fatal console error ×2). Item-level routes (`-show`, like `-create`/`-edit`) are now excluded from navigation tabs, and a `routeParamsSatisfied` guard (exported from `module/moduleRegistry`) drops any navlink whose target route requires params that aren't available — mirroring the breadcrumb's existing guard.
- fe73669: Shared minimal structural types (#1191, KPI-4). `EntityManager.interface.ts` now exports assignment-safe `EntityManagerLike` / `OrchestratorLike<M>` / `ToastLike` views (method-syntax members, so the canonical generic classes satisfy them structurally — compile-time asserted in `Orchestrator.ts`). The 24 drifting local `interface EntityManager/Orchestrator` redeclarations across composables, security and components are migrated onto them; only the two deliberate internal `EntityManagerInstance` ducks remain (KPI-9 scope). New `ButtonSeverity` union export replaces `severity: string` + `as any` casts in ShowPage/PageHeader. Types only — no runtime change.

## 2.2.1

### Patch Changes

- e2e90da: The router auth guard's entity access check now fails **closed** (#1190). Previously a blanket `catch {}` — intended for "entity not registered" — swallowed every error from the access check (e.g. a throwing `canRead()`), silently ALLOWING navigation. Registration is now checked explicitly (`orchestrator.isRegistered`, the only allowed pass-through); an unexpected failure in the access check logs a `console.error` and denies navigation.
- dc07d7f: Fix `query()` returning `{items: [], total: 0}` for any entity whose total exceeds `effectiveThreshold` (#1204). `list()` never filled the cache above the threshold but also never flagged the overflow, so `query()` — which `useListPage` uses — filtered an empty cache instead of hitting the API: **any entity growing past ~100 rows silently rendered an empty list**.

  The cache is an optional layer and now behaves like one: `list()` marks the cache `overflowed` when the total exceeds the threshold, the `overflow` getter reflects it, `query()` skips the futile cache-fill and goes straight to the API (server-side pagination), and `invalidateCache()` resets the flag so a shrunk entity can re-cache. Small entities keep the local-cache fast path unchanged.

## 2.2.0

### Minor Changes

- 5a5cd35: Fix the child-route `:id` collision (#1201): `ctx.crud(child, { show/form }, { parentRoute })` generated `parent/:id/child/:id` when parent and child both used `idField: 'id'` — the child param shadowed the parent, breaking parent resolution (breadcrumb, parentChain, FK filter) on every child show/edit page.

  **New naming policy (`parentParamMode: 'auto'`, default):**
  - List-only child families keep the bare param — `/jobs/:id/tasks` URLs are **unchanged**.
  - Families with show/edit routes namespace the parent and keep the principal (child) id bare: `/jobs/:jobId/tasks/:id`.

  **Overrides** (by precedence): per-call `CrudOptions.parentParam` (e.g. `'jobUuid'`) > kernel `routeParamResolver(ctx)` global mapping service > kernel `parentParamMode` (`'auto' | 'always' | 'bare'`; `bare` = legacy naming with an explicit registration error on collision instead of silent shadowing).

  Framework consumers read the resolved name from `route.meta.parent.param`, so breadcrumbs, parent chains and FK filters adapt automatically. Only app code reading `route.params.id` directly in a child show/edit page to get the **parent** id needs updating — that pattern was broken by the shadowing anyway.

## 2.1.0

### Minor Changes

- 51098aa: `useOptionsLookup` endpoint mode is now kernel-aware (#1198) — the raw-fetch footgun is gone.
  - **New kernel option `apiClient`** (`HttpClient` or factory), provided as `qdadmApiClient`: `new Kernel({ apiClient: myAxios })`. New exports: `useApiClient()`, `resolveApiClient()`, `API_CLIENT_INJECTION_KEY`.
  - **Endpoint routing precedence**: `via: 'entityName'` (new option — that entity's `storage.request()`) > relative endpoint → kernel `apiClient` (base URL + auth applied, zero per-call wiring) > absolute URL → raw `fetch` + `headers` (escape hatch, unchanged) > relative without a registered client → legacy raw fetch **with a console warning**.
  - **Failed lookups are no longer silent**: non-JSON responses (HTML page), 401/403 and parse failures log a `console.warn` naming the endpoint and the likely cause.
  - `ScopeEditor` falls back to the kernel `apiClient` when no `apiAdapter` is injected (existing contract unchanged).

  Purely additive — existing `endpoint` + `headers` calls keep working.

## 2.0.0

### Major Changes

- 3fbc921: **2.0.0 — dead-export removal + unified locale policy.**

  ## Removed exports (all verified consumer-free)

  | Removed                                                            | Migrate to                                                                             |
  | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
  | `useForm` (+ `UseFormOptions`, `UseFormReturn`, `FormAlterConfig`) | `useEntityItemFormPage` (entity forms) / `useBareForm` (custom forms)                  |
  | `FormTabs`, `FormTab` components                                   | `FieldGroups` with `layout="tabs"`                                                     |
  | `ActionColumn` component                                           | `ActionButtons` (data-driven, used by `ListPage`)                                      |
  | `useCurrentEntity` (+ `UseCurrentEntityReturn`)                    | `useStackHydrator().setCurrentData()`                                                  |
  | `get supportsCaching()` instance getter on the 5 storage adapters  | static `capabilities.supportsCaching` (e.g. `ApiStorage.capabilities.supportsCaching`) |

  ## Behavior change: one locale policy (browser locale)

  Date/number/currency rendering previously used three conflicting policies (`fr-FR` hardcoded in `useListPage.formatDate`, `en-US` fallback in `ShowDisplay`, browser locale in `utils/formatters`). Everything now routes through `utils/formatters` with the **browser locale** by default:
  - `useListPage`'s `formatDate` no longer forces `fr-FR`.
  - `ShowDisplay` no longer falls back to `en-US`; the per-field `field.locale` override still wins.
  - `formatDate` / `formatDateOnly` / `formatNumber` gain an optional trailing `locale` parameter; new `formatCurrency(value, currencyCode?, locale?)` export.

  If your app relied on the hardcoded `fr-FR`/`en-US` rendering, pass `field.locale` explicitly (show fields) or set the browser/app locale.

### Patch Changes

- 92ceeaa: Fix `EntityManager.list()` total extraction on the resolved-endpoint path (child lists via `resolveStorage` → `storage.request`). Wrapper responses like `{ data: [...], pagination: { total } }` (or `{ data: [...], total }`) had their total read from the unwrapped items array, falling back to the page length — so pagination believed there was only one page. The wrapper-level `total` / `pagination.total` are now read before the page-length fallback (#1197).

## 1.22.0

### Minor Changes

- 916d871: `VanillaJsonEditor` now supports inline JSON Schema validation (qdadm #1050).

  New optional props forward vanilla-jsoneditor's native `validator`:
  - `:schema="<JSON Schema>"` — compiled with `createAjvValidator` (Ajv is bundled in vanilla-jsoneditor, no new dependency), errors are highlighted live in the editor tree/text;
  - `:validator="<fn>"` — a raw validator for advanced cases, takes precedence over `schema`;
  - `:schema-definitions` / `:ajv-options` — passthrough to the Ajv validator.

  With none set, behavior is unchanged (no validation). Schema/validator changes are reactive (`editor.updateProps`). Validation errors already surface through the existing `error` event and the editor's status bar.

## 1.21.0

### Minor Changes

- 76f1ba8: Add `i18n.emitMissing` option (default `true`) to silence the `i18n:missing` debug signal (qdadm #1048).

  In an untranslated app, every unresolved key fires `i18n:missing`, flooding the debug panel's "Missing" section. Set `new Kernel({ i18n: { emitMissing: false } })` to suppress that stream. No functional impact — only the debug collector consumes the signal, so the section just stays empty; `i18n:domain-loaded`, `locale:changed`, and the inbound `locale:change` listener are unaffected.

## 1.20.0

### Minor Changes

- 062006e: Add `<ParentCard>` — a normalized parent detail cartouche for embedding at the top of a child `ListPage` (the "B2" hybrid composition, qdadm #1038).

  On a child-list route, `useListPage` already resolves and exposes the parent record (`parentData` / `parentLoading`) with no extra fetch. `<ParentCard>` renders it read-only above the table, auto-deriving its fields from the parent entity's manager and using the **same** field resolver as `ShowPage`, so the cartouche looks exactly like a real detail page:

  ```vue
  <template #beforeTable>
    <ParentCard
      :entity="'books'"
      :data="list.parentData.value"
      :loading="list.parentLoading.value"
    />
  </template>
  ```

  Pass `fields` to restrict/order the displayed fields, or use the default slot to render the parent yourself with the resolved field set. Works whether the child route comes from `ctx.crud(...,{foreignKey})` or `ctx.childPage()` — it only depends on `parentData`.

  Internally, the show field-resolver (schema-type → display-type mapping, auto reference routes, severity badges) was extracted into a shared `createShowFieldResolver` used by both `useEntityItemShowPage` and `<ParentCard>` — no behavior change to existing show pages.

## 1.19.7

### Patch Changes

- c80ed6c: Drop the Vite-specific `?raw` import for the built-in i18n defaults so qdadm works across bundlers and in `file:`/symlink consumer setups (qdadm #492).

  `DefaultCoreProvider` previously did `import('./core.<locale>.yml?raw')`. The `?raw` query is a Vite-only binding: when qdadm is consumed via a `file:` link through a symlink (testbed, `npm link`, pnpm workspace), Vite serves the YAML over `@fs/<realpath>`, the real path resolves outside the consumer's workspace root, and `server.fs.allow` rejects it — breaking the admin at boot. It also fails outright under non-Vite bundlers (Webpack, esbuild, standalone Rollup) that don't understand `?raw`.

  The `core.<locale>.yml` files remain the editable, translator-friendly source of truth. A generator (`scripts/gen-i18n-defaults.mjs`, `npm run gen:i18n-defaults`) emits committed `core.<locale>.generated.ts` modules that `export default` the raw YAML string; the provider now imports those plain TS modules. No build step at publish (the `.generated.ts` are committed, preserving the source-only model), per-locale code-splitting is unchanged, and a test fails if a `.yml` is edited without regenerating. Consumers on `file:`/symlink setups can drop the `server.fs.allow` workaround.

## 1.19.6

### Patch Changes

- 57f0acb: Fix two `TS2532: Object is possibly 'undefined'` errors that leaked to consumers via the source-only distribution. Under `noUncheckedIndexedAccess`, indexed access returns `T | undefined`, and neither a `.length === 1` check nor a bounded `for` loop narrows the element type for the compiler:
  - `useOptionsLookup.ts` — `filtered[0].toLowerCase()` guarded only by `filtered.length === 1`; now binds the sole element to a local that the `!== undefined` check narrows.
  - `EntityManager.cache.ts` — `entries[i][0]` inside the eviction loop; now iterates `entries.slice(0, toRemove)` and destructures the key, dropping the unchecked index entirely.

  No runtime behavior change — `vue-tsc --noEmit` against the package source is now clean. Reported in qdadm #1019.

## 1.19.5

### Patch Changes

- 1a35219: Fix codegen class-mode constructor TS2345 on `fields`. The generated `Generated${X}Manager` constructor was typing its `options` argument as a hand-rolled `Partial<{ ... fields: Record<string, unknown>; [key: string]: unknown }>`. The toxic combo (`Record<string, unknown>` + index signature) widened the inline literal's strictly-typed `fields: Record<string, FieldConfig>` at the `super({ ...literal, ...options })` spread, so `vue-tsc --noEmit` against generated files reported `TS2345: Argument of type '{ ...; fields: Record<string, unknown>; ... }' is not assignable to parameter of type 'EntityManagerOptions<XxxEntity>'`.

  The codegen now emits `constructor(options: Partial<EntityManagerOptions<${className}Entity>> = {})` and imports `EntityManagerOptions` from `@quazardous/qdadm`. The signature stays in sync with the parent class automatically — future additions to `EntityManagerOptions` no longer require touching the template — and the strict `fields` typing survives the spread. Reported by skybot-claude on `vue-tsc --noEmit` over generated managers in 1.19.4.

- 8043b44: Fix asymmetric button size between `FormPage` and `ListPage` header actions. `ListPage.vue` forced `size='small'` on its header action buttons, but `FormPage.vue` rendered actions from `form.addAction(...)` without a `size` prop — so PrimeVue's default (normal/large) showed up on edit pages, breaking visual coherence with the list. Reported by skybot-claude in qdadm #1016.

  `FormPage.vue` now renders header actions with `:size="action.size || 'small'"` to match `ListPage`. Symmetric overrides: `size?: string` is now part of the shared `ActionConfig` (`useEntityItemFormPage.types.ts`) and `HeaderActionConfig` (`useListPage.types.ts`) — consumers can opt into a different size from either side without touching component code. `ListPage.vue`'s local widening `interface ResolvedHeaderAction extends BaseResolvedHeaderAction { size?: string }` is removed since the base type now carries `size` directly.

  Default remains `'small'` on both pages, so no breaking change for existing consumers.

## 1.19.4

### Patch Changes

- Two docs/devDeps tweaks driven by feedback from a downstream consumer (qdcms) who hit a primevue dedupe trap when consuming qdadm via a `file:` link from a sibling monorepo:
  - **README — new section "Consuming via `file:` link from a sibling monorepo"** documents the `resolve.dedupe` pattern in the host's bundler config. Symptom = PrimeVue components render without Aura preset tokens (paginator buttons collapsed, datatable padding gone) because two copies of `primevue` end up in the bundle when the symlink is followed into the qdadm-monorepo's hoisted `node_modules`. Fix is one line in `vite.config.ts`: `resolve.dedupe: ['vue', 'vue-router', 'primevue', '@primeuix/themes']`. Doesn't affect npm consumers (the tarball ships no `node_modules/`) — purely a `file:`/`workspace:` link trap.
  - **`primevue` and `@primeuix/themes` added to `devDependencies`**, complementing the existing `peerDependencies` entries. The library itself doesn't ship primevue (it stays a peer), but local tests/builds of qdadm now resolve a deterministic version instead of relying on whatever the consumer workspace happens to have hoisted.

## 1.19.3

### Renamed — `qdadm` → `@quazardous/qdadm`

The package has been renamed from the unscoped `qdadm` to the scoped `@quazardous/qdadm`, joining `@quazardous/qdcore` and `@quazardous/qddebug` under a single scope. The unscoped `qdadm` on npm (versions up to 1.19.2) is being deprecated with a redirect notice. **Consumers must update**:

```diff
- "qdadm": "^1.19.2"
+ "@quazardous/qdadm": "^1.19.3"
```

```diff
- import { EntityManager } from "qdadm"
+ import { EntityManager } from "@quazardous/qdadm"
```

The codegen output also switches: generated `import { EntityManager } from "qdadm"` lines become `from "@quazardous/qdadm"`. Re-run `qdadmGen` after upgrade to refresh the generated files. The library API is unchanged — this is strictly a name/import-path migration.

The reasoning: keeping `qdadm` as an unscoped name created a permanent special case for tokens (npm Granular tokens scoped to `@quazardous` don't cover unscoped packages), Trusted Publishers (per-package config instead of scope-level), and CI tooling. Folding into the scope removes that whole class of friction.

### Patch Changes

- Three fixes reported by a downstream consumer running `vue-tsc --noEmit` against `qdadm@1.19.2`:
  - **Codegen now parameterizes the storage class with the entity type.** Generated managers were emitting `new ApiStorage(opts)` which defaults to `IStorage<EntityRecord>`; `EntityManager<XxxEntity>` expects `IStorage<XxxEntity>`, so every generated `*.ts` file failed type-check with TS2322. The codegen now emits `new ApiStorage<XxxEntity>(opts)` in both instance and class modes. Class mode also stops typing the constructor's `storage` override as `unknown` and uses `IStorage<XxxEntity>` instead.
  - **`vite-env.d.ts` declares `*.scss`, `*.css`, `*.sass` directly.** Previously these were only reachable through the `/// <reference types="vite/client" />` triple-slash, which silently failed for consumers whose `tsconfig.compilerOptions.types` didn't include `vite/client` or who didn't have `vite` installed. The internal `import('./styles.scss')` calls in `Module.ts`, `DebugModule.ts`, and `NotificationModule.ts` now type-check from any consumer context.
  - **`vite` declared as an optional peer dependency** with the wide range `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`, mirroring `@vitejs/plugin-vue@6.x`. Bumped the dev dep `@vitejs/plugin-vue` to `^6.0.0`. Consumers on Vite 7+ will see `qdadm/gen/vite-plugin` and `qdadm/vite-plugin-debug` resolve `Plugin` against their own Vite without the cross-version `Plugin<any>` mismatch that was hitting their `vue-tsc --noEmit`.

> **Note**: From 1.19.3 onwards, this per-package changelog is the source of truth, written automatically by [Changesets](https://github.com/changesets/changesets) on each release. For history up to 1.19.2 (and for cross-package release notes that pre-date Changesets adoption), see the repository root [../../CHANGELOG.md](../../CHANGELOG.md).
