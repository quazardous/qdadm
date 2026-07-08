/**
 * Consumer smoke surface (#1024) — every import below must typecheck against
 * the PACKED tarball under strict TS, exactly like a real consumer app.
 * Exercised patterns mirror what the skybot admin actually does:
 * manager subclassing, registry augmentation, structural views, storage
 * resolution overrides, codegen entry, utils.
 */
import {
  EntityManager,
  useEntity,
  useOrchestrator,
  useListPage,
  type EntityRecord,
  type StorageResolution,
  type RoutingContext,
  type EntityManagerRead,
  type QdadmManagerRegistry as _QdadmManagerRegistry,
} from '@quazardous/qdadm'
import { generateManagers, OpenAPIConnector } from '@quazardous/qdadm/gen'
import { humanizeFieldName, formatFetchError } from '@quazardous/qdadm/utils'

// ── Manager subclass + registry augmentation (the #1253 pattern) ────────────
interface BotEntity extends EntityRecord {
  uuid: string
  lastSeen?: string | null
}

class BotsManager extends EntityManager<BotEntity> {
  validate(): boolean {
    return true
  }

  // Overriding resolveStorage with the EXPORTED type — the #1253 point 2 use
  resolveStorage(op: string, context?: RoutingContext): StorageResolution<BotEntity> {
    if (op === 'list' && context?.parentChain?.length) return '/api/nested/bots'
    return undefined
  }
}

declare module '@quazardous/qdadm' {
  interface QdadmManagerRegistry {
    bots: BotsManager
  }
}

// Registry hit returns the subclass…
export function checkRegistry(): boolean {
  const bots = useEntity('bots')
  return bots.validate()
}

// …unregistered names keep the historical fallback.
export function checkFallback(): Promise<unknown> {
  const other = useEntity('anything')
  // @ts-expect-error validate() must not exist on the base EntityManager
  void other.validate
  return other.get(1)
}

// ── Structural view: the implementer's minimum (#1253 phase 2) ──────────────
export const managerLike: EntityManagerRead = {
  idField: 'id',
  getEntityLabel: () => 'x',
  canRead: () => true,
  canCreate: () => true,
  canUpdate: () => true,
  canDelete: () => true,
  get: async () => ({}),
  list: async () => ({ items: [] }),
  query: async () => ({ items: [] }),
  delete: async () => {},
  request: async () => ({}),
  invalidateCache: () => {},
  getFieldConfig: () => null,
}

// ── Composable surfaces used from setup() in real pages ─────────────────────
export function setupLikeUsage(): void {
  const { getManager, hasManager } = useOrchestrator()
  if (hasManager('bots')) {
    getManager('bots').validate()
  }
  const list = useListPage({ entity: 'bots' })
  // column() binding helper (#1255)
  const bound = list.column('lastSeen', { sortable: true })
  void bound.header
}

// ── Codegen entry (types only — no FS side effect at typecheck) ─────────────
export async function genUsage(): Promise<string[]> {
  const connector = new OpenAPIConnector({ inferLabels: 'humanize', inferReadOnly: true })
  const schemas = connector.parse({ openapi: '3.0.0', paths: {} })
  return generateManagers({
    output: '/tmp/never-run',
    classMode: true,
    baseClass: { import: './base', name: 'SmokeBase' },
    entities: Object.fromEntries(
      schemas.map((schema) => [
        schema.name,
        {
          schema,
          endpoint: schema.endpoint ?? '/api/x',
          storageImport: '@quazardous/qdadm',
          storageClass: 'ApiStorage',
        },
      ])
    ),
  })
}

// ── Utils ────────────────────────────────────────────────────────────────────
export const label: string = humanizeFieldName('botUuid')
export const err: string | null = formatFetchError({ message: 'boom' }, 'fallback')
