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
 */
import { z } from 'zod'

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

export interface ToolDef {
  name: string
  description: string
  // zod raw shape (registerTool inputSchema)
  inputSchema: Record<string, z.ZodTypeAny>
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

const session = z
  .string()
  .optional()
  .describe("Target session id (default 'latest' — the most recently active tab)")

class NoSessionError extends Error {}

function resolveSession(api: DebugBrokerApi, args: Record<string, unknown>) {
  const s = api.pickSession((args.session as string) ?? 'latest')
  if (!s) {
    throw new NoSessionError(
      'No connected browser session. Open the app in a browser once, then retry. ' +
        `Known sessions: ${JSON.stringify(api.listSessions())}`
    )
  }
  return s
}

/** Wrap a payload with the session stamp every response must carry (#1398). */
function stamped(s: { id: string; lastSeenAt: number }, data: unknown) {
  return { session: { id: s.id, ageMs: Date.now() - s.lastSeenAt }, data }
}

export function buildToolset(api: DebugBrokerApi, options: ToolsetOptions = {}): ToolDef[] {
  const readOnly = options.readOnly ?? false

  const ask = async (
    args: Record<string, unknown>,
    type: string,
    payload?: unknown
  ): Promise<unknown> => {
    const s = resolveSession(api, args)
    const data = await api.ask(type, payload, s.id)
    return stamped(s, data)
  }

  const tools: ToolDef[] = [
    {
      name: 'session_info',
      description:
        'Identity card of the live app session: app name/version, boot time, current route, ' +
        'bridge readiness, buffered-error counts. Call this FIRST — it detects zombie tabs ' +
        '(stale HMR chunks) and tells you which session you are talking to.',
      inputSchema: { session },
      handler: (a) => ask(a, 'sessionInfo'),
    },
    {
      name: 'boot_errors',
      description:
        'Console errors/warnings, page errors and unhandled rejections buffered since BEFORE ' +
        'the app booted — works even when the app died before the debug bridge existed ' +
        '(blank-page class of failures).',
      inputSchema: { session },
      handler: (a) => ask(a, 'bootlog'),
    },
    {
      name: 'routes',
      description:
        'All registered routes: name, path, and meta (entity, layout, auth flags). Route NAMES ' +
        'are singularized (entity "tasks" → route "task") while paths stay plural.',
      inputSchema: { session },
      handler: (a) => ask(a, 'routes'),
    },
    {
      name: 'entity_state',
      description:
        'Without `entity`: the list of registered entities. With `entity`: its manager state — ' +
        'idField (beware: often not "id"), labelField, field schema, CURRENT-USER permissions ' +
        '(canCreate/read/update/delete), and the storage kind + localStorage key.',
      inputSchema: { session, entity: z.string().optional() },
      handler: (a) => ask(a, 'entityState', { entity: a.entity }),
    },
    {
      name: 'entity_list',
      description:
        'List records through the EntityManager (permissions, cache and signals apply — the ' +
        'same path the UI uses). params supports page/page_size/search/filters/sort_by.',
      inputSchema: {
        session,
        entity: z.string(),
        params: z.record(z.unknown()).optional(),
      },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'list', params: a.params }),
    },
    {
      name: 'entity_get',
      description: 'Fetch one record by id through the EntityManager.',
      inputSchema: { session, entity: z.string(), id: z.union([z.string(), z.number()]) },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'get', id: a.id }),
    },
    {
      name: 'storage_dump',
      description:
        "RAW storage view for an entity (localStorage-backed storages): the key and its parsed " +
        'content, bypassing the manager. Diff against entity_list to catch seed/cache/collision ' +
        'bugs — the manager view and the raw view disagreeing IS the finding.',
      inputSchema: { session, entity: z.string() },
      handler: (a) => ask(a, 'storageDump', { entity: a.entity }),
    },
    {
      name: 'recent_signals',
      description:
        'Ring buffer of the last signal names emitted on the bus (auth:login, entity:*:created…). ' +
        'Arms on first call if the app is up.',
      inputSchema: { session },
      handler: (a) => ask(a, 'recentSignals'),
    },
    {
      name: 'describe',
      description:
        'Discovery: the self-describing manifests of every debug collector (entry shapes + ' +
        'available actions). Use it to find collector actions callable via bridge_call.',
      inputSchema: { session },
      handler: (a) => ask(a, 'describe'),
    },
    {
      name: 'bridge_call',
      description:
        'Escape hatch: invoke any collector action exposed by describe — ' +
        '{ collector, action, args }.',
      inputSchema: {
        session,
        collector: z.string(),
        action: z.string(),
        args: z.record(z.unknown()).optional(),
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
      inputSchema: { session, entity: z.string(), data: z.record(z.unknown()) },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'create', data: a.data }),
    },
    {
      name: 'entity_update',
      description: 'Update a record by id through the EntityManager.',
      inputSchema: {
        session,
        entity: z.string(),
        id: z.union([z.string(), z.number()]),
        data: z.record(z.unknown()),
      },
      handler: (a) =>
        ask(a, 'entityCall', { entity: a.entity, op: 'update', id: a.id, data: a.data }),
    },
    {
      name: 'entity_delete',
      description: 'Delete a record by id through the EntityManager.',
      inputSchema: { session, entity: z.string(), id: z.union([z.string(), z.number()]) },
      handler: (a) => ask(a, 'entityCall', { entity: a.entity, op: 'delete', id: a.id }),
    },
  ]

  return readOnly ? tools : [...tools, ...writes]
}
