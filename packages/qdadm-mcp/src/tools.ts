/**
 * Curated MCP toolset over the qdadm debug broker (#1398).
 *
 * Every tool maps to a real debugging moment (see the ticket's grounded
 * analysis): zombie-tab detection, route lookup, entity/permission state,
 * manager-level CRUD, raw-storage diffing, error/signal windows, and
 * pre-boot failure capture. The generic `bridge_call` is the single escape
 * hatch into collector actions; collector manifests are exposed through
 * `describe` for discovery — deliberately NOT auto-expanded into one tool
 * per action (tool-soup drowns agents).
 *
 * Tools receive the broker surface exposed by qdadm's debug plugin via the
 * Vite inter-plugin `api` (duck-typed here — no dependency on qdadm).
 *
 * Argument schemas are plain `ToolArg` specs, not zod (#1497): the MCP SDK
 * validates zod shapes BEFORE the handler runs and surfaces failures as raw
 * ZodError JSON dumps. Our own registration layer (server.ts) advertises
 * these specs as JSON Schema and validates them with one-sentence
 * actionable errors — the same register as the no-session message.
 */

/** Duck-typed view of qdadm's QdadmDebugPluginApi. */
export interface DebugBrokerApi {
  ask: (type: string, payload?: unknown, sessionId?: string) => Promise<unknown>
  pickSession: (
    sessionParam: string | null
  ) => { id: string; lastSeenAt: number; meta: Record<string, unknown> } | null
  listSessions: () => Array<Record<string, unknown>>
  prefix: string
  /**
   * Pairing (#2231) — the relay only. The dev-server broker has none: vite
   * serves the page it talks to.
   */
  pairing?: {
    status: () => unknown
    accept: (code: string) => unknown
  }
}

export interface ToolsetOptions {
  /** Leave out the tools that change data or act in the page: WRITE_TOOLS (default false). */
  readOnly?: boolean
}

/** What `readOnly` leaves out: the entity writes, and acting in the page as the user. */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  'entity_create',
  'entity_update',
  'entity_delete',
  'click',
  'type_text',
  'fill',
  'press_key',
  'drag',
  'upload_file',
  'page_eval',
])

/**
 * Argument spec — the whole vocabulary the toolset needs.
 * `string` / `id` (string|number) / `object` (free-form record).
 */
export interface ToolArg {
  kind: 'string' | 'id' | 'object' | 'number' | 'boolean' | 'array' | 'any'
  required?: boolean
  description: string
}

export interface ToolDef {
  name: string
  description: string
  args: Record<string, ToolArg>
  /**
   * Tool-specific guidance replacing the generic "open the app in a
   * browser" advice when no session is connected (#1497 — boot_errors is
   * exactly the tool an agent reaches for when the page is blank).
   */
  noSessionHint?: string
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

/** An answer that is not JSON (#2247): text written for an agent to read, or an image. */
export class ToolContent {
  // A plain field, not a parameter property: the relay also runs from source, under Node's type stripping.
  readonly content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>

  constructor(content: ToolContent['content']) {
    this.content = content
  }
}

const instance: ToolArg = {
  kind: 'string',
  description:
    'Which app instance (browser tab) to target — an id from `instances`, or its first 8 characters. ' +
    'May be omitted while a single instance is connected.',
}

/** The target an agent named — `session` is the pre-#2231 name, still honoured. */
const targetOf = (args: Record<string, unknown>) => ((args.instance ?? args.session) as string | undefined) ?? 'latest'

const entity: ToolArg = {
  kind: 'string',
  required: true,
  description: 'Entity name, as registered in the app',
}

const id: ToolArg = {
  kind: 'id',
  required: true,
  description: 'Record id (mind entity_state.idField — it is often not "id")',
}

export class NoSessionError extends Error {
  readonly sessions: Array<Record<string, unknown>>

  constructor(sessions: Array<Record<string, unknown>>, hint?: string) {
    super(
      'No connected browser session. ' +
        (hint ?? 'Open the app in a browser once, then retry.') +
        ` Known sessions: ${JSON.stringify(sessions)}`
    )
    this.sessions = sessions
  }
}

const pairHint =
  'No app instance is connected to the relay. Start the app with its dev server — its tabs connect on their own ' +
  '— or ask the user to open the MCP tab of the app\'s debug bar, click Pair, and read you the code it shows; ' +
  'then call pair_accept with it.'

function resolveSession(api: DebugBrokerApi, args: Record<string, unknown>, hint?: string) {
  const s = api.pickSession(targetOf(args))
  if (!s) throw new NoSessionError(api.listSessions(), hint ?? (api.pairing ? pairHint : undefined))
  return s
}

/** Wrap a payload with the session stamp every response must carry (#1398). */
function stamped(s: { id: string; lastSeenAt: number }, data: unknown) {
  return { session: { id: s.id, ageMs: Date.now() - s.lastSeenAt }, data }
}

/**
 * Best-effort list of registered entity names, for enriching entity-arg
 * validation errors (#1497). Null when no session or the ask fails — the
 * caller falls back to pointing at entity_state.
 */
export async function listRegisteredEntities(
  api: DebugBrokerApi,
  args: Record<string, unknown>
): Promise<string[] | null> {
  try {
    const s = api.pickSession(targetOf(args))
    if (!s) return null
    const data = (await api.ask('entityState', {}, s.id)) as { entities?: unknown }
    return Array.isArray(data?.entities) ? (data.entities as string[]) : null
  } catch {
    return null
  }
}

export function buildToolset(api: DebugBrokerApi, options: ToolsetOptions = {}): ToolDef[] {
  const readOnly = options.readOnly ?? false

  const makeAsk =
    (hint?: string) =>
    async (args: Record<string, unknown>, type: string, payload?: unknown): Promise<unknown> => {
      const s = resolveSession(api, args, hint)
      const data = await api.ask(type, payload, s.id)
      return stamped(s, data)
    }
  const ask = makeAsk()

  /**
   * On the relay, a call that acts on the tab also returns what happened in it
   * while the call ran (#2247): route change, console errors and warnings,
   * toasts, missing i18n keys, failed API calls, signals.
   */
  const relay = !!api.pairing
  const act = async (args: Record<string, unknown>, type: string, payload?: unknown): Promise<unknown> => {
    if (!relay) return ask(args, type, payload)
    const s = resolveSession(api, args)
    const mark = await api.ask('feedbackMark', undefined, s.id).catch(() => null)
    if (!mark) return ask(args, type, payload) // a connector without feedback support
    let data: unknown
    try {
      data = await api.ask(type, payload, s.id)
    } catch (e) {
      const feedback = await api.ask('feedbackSince', { mark }, s.id).catch(() => null)
      throw new Error(`${(e as Error).message}${feedback ? ` — meanwhile in the tab: ${JSON.stringify(feedback)}` : ''}`)
    }
    const feedback = await api.ask('feedbackSince', { mark }, s.id).catch(() => null)
    return { ...stamped(s, data), feedback }
  }

  /** Page reads come back as text to read, headed by the instance they came from. */
  const readText = async (args: Record<string, unknown>, type: string, payload: Record<string, unknown>) => {
    const s = resolveSession(api, args)
    const { text } = (await api.ask(type, payload, s.id)) as { text: string }
    return new ToolContent([{ type: 'text', text: `Instance ${s.id.slice(0, 8)}. ${text}` }])
  }

  const bootErrorsHint = api.pairing
    ? pairHint +
      ' A tab paired once re-pairs on reload before the app runs, so boot_errors sees a blank-page crash too.'
    : 'boot_errors needs an open tab: the pre-boot buffer lives in the page. ' +
      'Open the app URL in a browser — even if it renders a blank page, the capture ' +
      'script loads before the app and holds everything it threw while dying. Then retry.'
  const askBootErrors = makeAsk(bootErrorsHint)

  const tools: ToolDef[] = [
    {
      name: 'session_info',
      description:
        'Identity card of the live app session: app name/version, boot time, current route, ' +
        'bridge readiness, buffered-error counts. Call this FIRST — it detects zombie tabs ' +
        '(stale HMR chunks) and tells you which session you are talking to.',
      args: { instance },
      handler: (a) => ask(a, 'sessionInfo'),
    },
    {
      name: 'boot_errors',
      description:
        'Console errors/warnings, page errors and unhandled rejections buffered by the ' +
        'pre-boot capture script, which loads BEFORE the app bundle — so it holds everything ' +
        'the app threw while dying (blank-page class of failures). Needs a connected tab: the ' +
        'buffer lives in the page, so open the app URL even if it renders blank.',
      args: { instance },
      noSessionHint: bootErrorsHint,
      handler: (a) => askBootErrors(a, 'bootlog'),
    },
    {
      name: 'routes',
      description:
        'All registered routes: name, path, and meta (entity, layout, auth flags). Route NAMES ' +
        'are singularized (entity "tasks" → route "task") while paths stay plural.',
      args: { instance },
      handler: (a) => ask(a, 'routes'),
    },
    {
      name: 'entity_state',
      description:
        'Without `entity`: the list of registered entities. With `entity`: its manager state — ' +
        'idField (beware: often not "id"), labelField, field schema, CURRENT-USER permissions ' +
        '(canCreate/read/update/delete), and the storage kind + localStorage key.',
      args: { instance, entity: { ...entity, required: false } },
      handler: (a) => ask(a, 'entityState', { entity: a.entity }),
    },
    {
      name: 'entity_list',
      description:
        'List records through the EntityManager (permissions, cache and signals apply — the ' +
        'same path the UI uses). params supports page/page_size/search/filters/sort_by.',
      args: {
        instance,
        entity,
        params: {
          kind: 'object',
          description: 'Query params: page/page_size/search/filters/sort_by',
        },
      },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'list', params: a.params }),
    },
    {
      name: 'entity_get',
      description: 'Fetch one record by id through the EntityManager.',
      args: { instance, entity, id },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'get', id: a.id }),
    },
    {
      name: 'storage_dump',
      description:
        'RAW storage view for an entity (localStorage-backed storages): the key and its parsed ' +
        'content, bypassing the manager. Diff against entity_list to catch seed/cache/collision ' +
        'bugs — the manager view and the raw view disagreeing IS the finding.',
      args: { instance, entity },
      handler: (a) => ask(a, 'storageDump', { entity: a.entity }),
    },
    {
      name: 'recent_signals',
      description:
        'Ring buffer of the last signal names emitted on the bus (auth:login, entity:*:created…). ' +
        'Arms on first call if the app is up.',
      args: { instance },
      handler: (a) => ask(a, 'recentSignals'),
    },
    {
      name: 'describe',
      description:
        'Discovery: the self-describing manifests of every debug collector (entry shapes + ' +
        'available actions). Use it to find collector actions callable via bridge_call.',
      args: { instance },
      handler: (a) => ask(a, 'describe'),
    },
    {
      name: 'bridge_call',
      description:
        'Escape hatch: invoke any collector action exposed by describe — ' +
        '{ collector, action, args }.',
      args: {
        instance,
        collector: {
          kind: 'string',
          required: true,
          description: 'Collector name (see describe)',
        },
        action: {
          kind: 'string',
          required: true,
          description: 'Action name on the collector (see describe)',
        },
        args: { kind: 'object', description: 'Action arguments' },
      },
      handler: (a) =>
        act(a, 'call', { collector: a.collector, action: a.action, args: a.args ?? {} }),
    },
    {
      name: 'instances',
      description:
        'The app instances (browser tabs) you can target: id, app, page, origin, how each connected, and ' +
        'whether it is connected or reloading. Pass an id as `instance` to the other tools when several are connected.',
      args: {},
      handler: async () => ({
        instances: api.listSessions(),
        ...(api.pairing ? { waitingToPair: (api.pairing.status() as { waiting?: unknown }).waiting ?? [] } : {}),
      }),
    },
  ]

  const writes: ToolDef[] = [
    {
      name: 'entity_create',
      description:
        'Create a record through the EntityManager (permissions checked, signals emitted, ' +
        'caches invalidated — exactly like the UI).',
      args: {
        instance,
        entity,
        data: { kind: 'object', required: true, description: 'Record fields' },
      },
      handler: (a) => act(a, 'entityCall', { entity: a.entity, op: 'create', data: a.data }),
    },
    {
      name: 'entity_update',
      description: 'Update a record by id through the EntityManager.',
      args: {
        instance,
        entity,
        id,
        data: { kind: 'object', required: true, description: 'Fields to update' },
      },
      handler: (a) =>
        act(a, 'entityCall', { entity: a.entity, op: 'update', id: a.id, data: a.data }),
    },
    {
      name: 'entity_delete',
      description: 'Delete a record by id through the EntityManager.',
      args: { instance, entity, id },
      handler: (a) => act(a, 'entityCall', { entity: a.entity, op: 'delete', id: a.id }),
    },
  ]

  if (api.pairing) {
    const pairing = api.pairing
    tools.push(
      {
        name: 'navigate',
        description:
          'Navigate the tab like a user would (router push), then wait for the page to settle. Pass a path ' +
          '("/books/12/edit") or a route name with params (route "book-edit", params {"bookId": 12}; names come from ' +
          'routes). Returns the route reached, the page title and breadcrumb, and a feedback block: what happened in ' +
          'the tab meanwhile (console errors, toasts, missing i18n keys, failed API calls, signals).',
        args: {
          instance,
          path: { kind: 'string', description: 'Path to open, e.g. "/books"' },
          route: { kind: 'string', description: 'A route name instead of a path, e.g. "book-edit"' },
          params: { kind: 'object', description: 'Route params, with route' },
          query: { kind: 'object', description: 'Query string, with route' },
          history: { kind: 'string', description: '"back", "forward" or "reload" instead of a target' },
        },
        handler: (a) => act(a, 'navigate', { path: a.path, route: a.route, params: a.params, query: a.query, history: a.history }),
      },
      {
        name: 'hover',
        description: 'Move the pointer over an element (ref): tooltips, hover menus, row actions shown on hover.',
        args: { instance, ref: { kind: 'string', required: true, description: 'The element, from page_snapshot or find' } },
        handler: (a) => act(a, 'hover', { ref: a.ref }),
      },
      {
        name: 'scroll',
        description:
          'Scroll. With ref alone: bring that element into view. With direction (up, down, left, right) and an ' +
          'optional amount in pixels: scroll what is under ref, or under the middle of the viewport. Says where it ' +
          'stopped.',
        args: {
          instance,
          ref: { kind: 'string', description: 'The element to bring into view, or to scroll inside' },
          direction: { kind: 'string', description: 'up, down, left or right' },
          amount: { kind: 'number', description: 'Pixels (default: most of the viewport)' },
        },
        handler: (a) => act(a, 'scroll', { ref: a.ref, direction: a.direction, amount: a.amount }),
      },
      {
        name: 'console_messages',
        description:
          'The console of the tab: errors, warnings, page errors and unhandled rejections since it connected; log, ' +
          'info and debug from the first call on. level: error, warn, log, info, debug, pageerror, rejection, or ' +
          '"errors" for every failure. pattern: a regex on the text. The latest `limit` are kept (default 50). ' +
          'clear: the next call only shows newer messages.',
        args: {
          instance,
          level: { kind: 'string', description: 'Only this level' },
          pattern: { kind: 'string', description: 'Regex the text must match (case-insensitive)' },
          limit: { kind: 'number', description: 'How many of the latest (default 50)' },
          clear: { kind: 'boolean', description: 'Forget what was returned' },
        },
        handler: (a) => ask(a, 'consoleMessages', { level: a.level, pattern: a.pattern, limit: a.limit, clear: a.clear }),
      },
      {
        name: 'network_requests',
        description:
          'The fetch and XMLHttpRequest calls of the tab since it connected: method, URL, status, duration, or the ' +
          'network error. urlPattern: part of the URL. failedOnly: status 400+ or no response. The latest `limit` are ' +
          'kept (default 50). clear: the next call only shows newer requests.',
        args: {
          instance,
          urlPattern: { kind: 'string', description: 'Part of the URL, e.g. "/api/books"' },
          failedOnly: { kind: 'boolean', description: 'Only failures' },
          limit: { kind: 'number', description: 'How many of the latest (default 50)' },
          clear: { kind: 'boolean', description: 'Forget what was returned' },
        },
        handler: (a) => ask(a, 'networkRequests', { urlPattern: a.urlPattern, failedOnly: a.failedOnly, limit: a.limit, clear: a.clear }),
      },
      {
        name: 'page_snapshot',
        description:
          'What the user sees in the tab, as an accessibility tree: one line per element with its role, name, ' +
          'states and value — `- textbox "Title" [required] [invalid] [value="Dune"] [ref=e9]` — and the text ' +
          'around it. Every element carries a ref that find and the action tools take. Refs stay valid while the ' +
          'element lives; a re-rendered one says so. The debug bar is left out; fields in error are listed at the ' +
          'end. Far cheaper than a screenshot.',
        args: {
          instance,
          filter: { kind: 'string', description: '"interactive": only what can be acted on, as a flat list. Default: the whole tree' },
          ref: { kind: 'string', description: 'Snapshot only this element, e.g. a dialog or a table ("e42")' },
          maxRows: { kind: 'number', description: 'Rows kept per table (default 20)' },
          maxChars: { kind: 'number', description: 'Cut the snapshot past this many characters (default 30000)' },
        },
        handler: (a) => readText(a, 'pageSnapshot', { filter: a.filter, ref: a.ref, maxRows: a.maxRows, maxChars: a.maxChars }),
      },
      {
        name: 'find',
        description:
          'Find elements in the tab by role and/or text (case-insensitive, in their name, value or text). Each ' +
          'result gives its ref and where it sits: its row, dialog, form. E.g. role "button" text "save", or text ' +
          '"Dune" to find its table row.',
        args: {
          instance,
          text: { kind: 'string', description: 'Text to look for' },
          role: { kind: 'string', description: 'ARIA role: button, link, textbox, combobox, checkbox, row, dialog…' },
          ref: { kind: 'string', description: 'Search inside this element only' },
          limit: { kind: 'number', description: 'Results returned (default 30)' },
        },
        handler: (a) => readText(a, 'find', { text: a.text, role: a.role, ref: a.ref, limit: a.limit }),
      },
      {
        name: 'page_text',
        description: 'The visible text of the tab (or of one element), as the user reads it — the debug bar left out.',
        args: {
          instance,
          ref: { kind: 'string', description: 'Only this element\'s text' },
          maxChars: { kind: 'number', description: 'Cut past this many characters (default 30000)' },
        },
        handler: (a) => readText(a, 'pageText', { ref: a.ref, maxChars: a.maxChars }),
      },
      {
        name: 'wait_for',
        description:
          'Wait until the tab reaches a route (a name, or a path prefix starting with "/") or emits a signal whose ' +
          'name matches a pattern (a regex, e.g. "^entity:books:"). On timeout, says where the tab is and which ' +
          'signals it saw meanwhile.',
        args: {
          instance,
          route: { kind: 'string', description: 'Route name, or a path prefix starting with "/"' },
          signal: { kind: 'string', description: 'Regex on signal names' },
          timeoutMs: { kind: 'number', description: 'Give up after this many milliseconds (default 5000, max 30000)' },
        },
        handler: (a) => ask(a, 'waitFor', { route: a.route, signal: a.signal, timeoutMs: a.timeoutMs }),
      },
      {
        name: 'chat_send',
        description:
          'Show a message in the chat of the MCP tab of the app\'s debug bar — to whoever is looking at that ' +
          'browser tab. Returns how many of their messages you have not read yet (chat_read).',
        args: {
          instance,
          message: { kind: 'string', required: true, description: 'The message to show' },
        },
        handler: (a) => ask(a, 'chatPost', { message: a.message }),
      },
      {
        name: 'chat_read',
        description:
          'What the user typed in the chat of the MCP tab since your last chat_read. The chat lives in the ' +
          'tab: a reload starts it afresh.',
        args: { instance },
        handler: (a) => ask(a, 'chatRead'),
      },
      {
        name: 'pair_accept',
        description:
          'Complete a pairing: the user clicked Pair in the MCP tab of the app\'s debug bar and read you the code it ' +
          'shows. Pass exactly that code — never guess or reuse one. The tab becomes an instance next to the ' +
          'others (see instances).',
        args: {
          code: { kind: 'string', required: true, description: 'The code shown in the debug bar' },
        },
        handler: async (a) => pairing.accept(String(a.code)),
      }
    )
  }

  if (api.pairing) {
    const ref: ToolArg = { kind: 'string', required: true, description: 'The element, from page_snapshot or find (e.g. "e12")' }
    writes.push(
      {
        name: 'click',
        description:
          'Click an element like a user: pointer and mouse events in a real click\'s order, focus, then the page ' +
          'settles. Refuses a disabled element, and one covered by something else — naming what covers it (a ' +
          'dialog, an overlay). button "right" opens a context menu, clickCount 2 double-clicks, modifiers ["Shift"]. ' +
          'Returns what was clicked, what has focus, the route, and the feedback block.',
        args: {
          instance,
          ref,
          button: { kind: 'string', description: 'left (default), right or middle' },
          clickCount: { kind: 'number', description: '2 for a double click' },
          modifiers: { kind: 'array', description: 'Keys held: ["Shift"], ["Control"], ["Alt"], ["Meta"]' },
        },
        handler: (a) => act(a, 'click', { ref: a.ref, button: a.button, clickCount: a.clickCount, modifiers: a.modifiers }),
      },
      {
        name: 'type_text',
        description:
          'Type text into a field key by key, as a user would: input masks, number fields and autocompletes see every ' +
          'key. ref: the field, or a wrapper holding one input; without ref, the focused element. clear empties it ' +
          'first; submit presses Enter after.',
        args: {
          instance,
          ref: { kind: 'string', description: 'The field (default: the focused element)' },
          text: { kind: 'string', required: true, description: 'What to type' },
          clear: { kind: 'boolean', description: 'Empty the field first' },
          submit: { kind: 'boolean', description: 'Press Enter after' },
        },
        handler: (a) => act(a, 'typeText', { ref: a.ref, text: a.text, clear: a.clear, submit: a.submit }),
      },
      {
        name: 'fill',
        description:
          'Set a field to a value, whatever the control. A text field is emptied and typed into. A checkbox or switch ' +
          'is clicked if its state differs (value true or false). A select or a PrimeVue dropdown is opened and its ' +
          'option clicked (value: the option\'s label). An autocomplete is typed into and the matching suggestion ' +
          'picked. A date input is set whole ("2026-09-11"). When the option is not there, the error lists those that are.',
        args: {
          instance,
          ref,
          value: { kind: 'any', required: true, description: 'Text, true/false for a checkbox, an option label, or an array for a multiple select' },
        },
        handler: (a) => act(a, 'fill', { ref: a.ref, value: a.value }),
      },
      {
        name: 'press_key',
        description:
          'Press keys: "Enter", "Escape", "Tab", "Shift+Tab", "Control+a", "ArrowDown", or several separated by ' +
          'spaces ("ArrowDown ArrowDown Enter"). On ref (focused first), else on the focused element. The browser\'s ' +
          'defaults run unless the app prevents them: Enter submits a form or presses a button, Tab moves focus, ' +
          'Space toggles, Backspace deletes.',
        args: {
          instance,
          keys: { kind: 'string', required: true, description: 'Keys to press' },
          ref: { kind: 'string', description: 'The element to press them on' },
        },
        handler: (a) => act(a, 'pressKey', { keys: a.keys, ref: a.ref }),
      },
      {
        name: 'drag',
        description:
          'Drag an element (ref) onto another (to): HTML5 drag and drop when the source is draggable, a pointer drag ' +
          'in steps otherwise (sortable lists, sliders).',
        args: { instance, ref, to: { kind: 'string', required: true, description: 'The element to drop onto' } },
        handler: (a) => act(a, 'drag', { ref: a.ref, to: a.to }),
      },
      {
        name: 'upload_file',
        description:
          'Attach files to a file input — ref: the input, or the upload button holding it. files: [{ "name": ' +
          '"notes.txt", "text": "…" }] for text, [{ "name": "cover.png", "base64": "…", "mimeType": "image/png" }] ' +
          'for binary.',
        args: { instance, ref, files: { kind: 'array', required: true, description: 'The files: name, and text or base64 (+ mimeType)' } },
        handler: (a) => act(a, 'uploadFile', { ref: a.ref, files: a.files }),
      },
      {
        name: 'page_eval',
        description:
          'Run JavaScript in the tab and get its value back, JSON-safe; elements come back described, with a ref. code: ' +
          'an expression ("document.title", "window.__qdadm.router.currentRoute.value.fullPath") or statements with a ' +
          'return; await works; $ref("e12") is the element behind a ref. It can do anything the page can: reach for ' +
          'the dedicated tools first.',
        args: { instance, code: { kind: 'string', required: true, description: 'An expression, or statements with return' } },
        handler: (a) => act(a, 'pageEval', { code: a.code }),
      }
    )
  }

  return readOnly ? tools.filter((t) => !WRITE_TOOLS.has(t.name)) : [...tools, ...writes]
}
