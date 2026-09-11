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
  /** Refuse entity_create / entity_update / entity_delete (default false). */
  readOnly?: boolean
}

/**
 * Argument spec — the whole vocabulary the toolset needs.
 * `string` / `id` (string|number) / `object` (free-form record).
 */
export interface ToolArg {
  kind: 'string' | 'id' | 'object' | 'number'
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
        },
        handler: (a) => act(a, 'navigate', { path: a.path, route: a.route, params: a.params, query: a.query }),
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

  return readOnly ? tools : [...tools, ...writes]
}
