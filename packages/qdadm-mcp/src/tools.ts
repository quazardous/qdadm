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
  kind: 'string' | 'id' | 'object'
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

const session: ToolArg = {
  kind: 'string',
  description: "Target session id (default 'latest' — the most recently active tab)",
}

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

function resolveSession(api: DebugBrokerApi, args: Record<string, unknown>, hint?: string) {
  const s = api.pickSession((args.session as string) ?? 'latest')
  if (!s) throw new NoSessionError(api.listSessions(), hint)
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
    const s = api.pickSession((args.session as string) ?? 'latest')
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

  const bootErrorsHint =
    'boot_errors needs an open tab: the pre-boot buffer lives in the page. ' +
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
      args: { session },
      handler: (a) => ask(a, 'sessionInfo'),
    },
    {
      name: 'boot_errors',
      description:
        'Console errors/warnings, page errors and unhandled rejections buffered by the ' +
        'pre-boot capture script, which loads BEFORE the app bundle — so it holds everything ' +
        'the app threw while dying (blank-page class of failures). Needs a connected tab: the ' +
        'buffer lives in the page, so open the app URL even if it renders blank.',
      args: { session },
      noSessionHint: bootErrorsHint,
      handler: (a) => askBootErrors(a, 'bootlog'),
    },
    {
      name: 'routes',
      description:
        'All registered routes: name, path, and meta (entity, layout, auth flags). Route NAMES ' +
        'are singularized (entity "tasks" → route "task") while paths stay plural.',
      args: { session },
      handler: (a) => ask(a, 'routes'),
    },
    {
      name: 'entity_state',
      description:
        'Without `entity`: the list of registered entities. With `entity`: its manager state — ' +
        'idField (beware: often not "id"), labelField, field schema, CURRENT-USER permissions ' +
        '(canCreate/read/update/delete), and the storage kind + localStorage key.',
      args: { session, entity: { ...entity, required: false } },
      handler: (a) => ask(a, 'entityState', { entity: a.entity }),
    },
    {
      name: 'entity_list',
      description:
        'List records through the EntityManager (permissions, cache and signals apply — the ' +
        'same path the UI uses). params supports page/page_size/search/filters/sort_by.',
      args: {
        session,
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
      args: { session, entity, id },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'get', id: a.id }),
    },
    {
      name: 'storage_dump',
      description:
        'RAW storage view for an entity (localStorage-backed storages): the key and its parsed ' +
        'content, bypassing the manager. Diff against entity_list to catch seed/cache/collision ' +
        'bugs — the manager view and the raw view disagreeing IS the finding.',
      args: { session, entity },
      handler: (a) => ask(a, 'storageDump', { entity: a.entity }),
    },
    {
      name: 'recent_signals',
      description:
        'Ring buffer of the last signal names emitted on the bus (auth:login, entity:*:created…). ' +
        'Arms on first call if the app is up.',
      args: { session },
      handler: (a) => ask(a, 'recentSignals'),
    },
    {
      name: 'describe',
      description:
        'Discovery: the self-describing manifests of every debug collector (entry shapes + ' +
        'available actions). Use it to find collector actions callable via bridge_call.',
      args: { session },
      handler: (a) => ask(a, 'describe'),
    },
    {
      name: 'bridge_call',
      description:
        'Escape hatch: invoke any collector action exposed by describe — ' +
        '{ collector, action, args }.',
      args: {
        session,
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
        ask(a, 'call', { collector: a.collector, action: a.action, args: a.args ?? {} }),
    },
  ]

  const writes: ToolDef[] = [
    {
      name: 'entity_create',
      description:
        'Create a record through the EntityManager (permissions checked, signals emitted, ' +
        'caches invalidated — exactly like the UI).',
      args: {
        session,
        entity,
        data: { kind: 'object', required: true, description: 'Record fields' },
      },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'create', data: a.data }),
    },
    {
      name: 'entity_update',
      description: 'Update a record by id through the EntityManager.',
      args: {
        session,
        entity,
        id,
        data: { kind: 'object', required: true, description: 'Fields to update' },
      },
      handler: (a) =>
        ask(a, 'entityCall', { entity: a.entity, op: 'update', id: a.id, data: a.data }),
    },
    {
      name: 'entity_delete',
      description: 'Delete a record by id through the EntityManager.',
      args: { session, entity, id },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'delete', id: a.id }),
    },
  ]

  return readOnly ? tools : [...tools, ...writes]
}
