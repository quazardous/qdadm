/**
 * A role's composition, as RoleGrantsEditor draws it (#2313): which registered grants the role holds, and where
 * each one comes from.
 *
 * Pure and judge-free. What inherited roles bring is given, never resolved here (the app's server may be the one
 * that judges); wildcards are read with PermissionMatcher, `*` being one segment and `**` any number.
 */
import { PermissionMatcher } from './PermissionMatcher'

/** A registry entry, or anything shaped like one (an app may pass its server's list). */
export interface GrantDefinition {
  key: string
  namespace: string
  action: string
  label?: string
  description?: string | null
}

/** A grant an inherited role brings, and the role that declares it. */
export interface InheritedGrant {
  permission: string
  via: string
}

/** What RoleGrantsEditor edits: the role's own composition, never what it inherits. */
export interface RoleComposition {
  inherits: string[]
  permissions: string[]
}

export interface InheritableRole {
  name: string
  label?: string
  description?: string
}

export type GrantOrigin =
  | { kind: 'none' }
  | { kind: 'own' }
  /** Covered by a wildcard the role holds. */
  | { kind: 'wildcard'; via: string }
  /** Brought by an inherited role. */
  | { kind: 'inherited'; via: string }

export interface GrantCell {
  key: string
  action: string
  label: string
  description: string | null
  origin: GrantOrigin
}

/** One entity of the matrix: `entity:books`, or its ownership grants `entity-own:books`. */
export interface GrantRow {
  namespace: string
  entity: string
  ownRecords: boolean
  /** `entity:books:*` */
  wildcard: string
  wildcardOrigin: GrantOrigin
  /** By action; null where the entity registers no such grant. */
  cells: Record<string, GrantCell | null>
}

/** Named grants of one namespace, as registered: `offers:debug:read` belongs to `offers:debug`, not `offers`. */
export interface GrantGroup {
  namespace: string
  wildcard: string
  wildcardOrigin: GrantOrigin
  grants: GrantCell[]
}

/** A key of the role that is neither a registered grant nor a row or group wildcard. */
export interface OtherGrant {
  key: string
  /** Registered grants it covers: 0 for a key the registry does not know. */
  covers: number
}

export interface GrantsModel {
  actions: string[]
  rows: GrantRow[]
  groups: GrantGroup[]
  others: OtherGrant[]
}

const STANDARD_ACTIONS = ['read', 'list', 'create', 'update', 'delete']

const isWildcard = (key: string) => key.includes('*')

/** Where a grant comes from for the role: its own key first, then its wildcards, then what it inherits. */
export function originOf(
  key: string,
  permissions: readonly string[],
  inherited: readonly InheritedGrant[] = []
): GrantOrigin {
  if (permissions.includes(key)) return { kind: 'own' }
  const wildcard = permissions.find((p) => isWildcard(p) && PermissionMatcher.matches(p, key))
  if (wildcard) return { kind: 'wildcard', via: wildcard }
  const brought = inherited.find((g) => PermissionMatcher.matches(g.permission, key))
  if (brought) return { kind: 'inherited', via: brought.via }
  return { kind: 'none' }
}

export function composeGrants(input: {
  grants: readonly GrantDefinition[]
  permissions: readonly string[]
  inherited?: readonly InheritedGrant[]
}): GrantsModel {
  const { grants, permissions } = input
  const inherited = input.inherited ?? []
  const cellOf = (g: GrantDefinition): GrantCell => ({
    key: g.key,
    action: g.action,
    label: g.label || g.key,
    description: g.description ?? null,
    origin: originOf(g.key, permissions, inherited),
  })

  const entityNamespaces = new Map<string, GrantDefinition[]>()
  const namedNamespaces = new Map<string, GrantDefinition[]>()
  for (const g of grants) {
    const target = /^entity(-own)?:/.test(g.namespace) ? entityNamespaces : namedNamespaces
    target.set(g.namespace, [...(target.get(g.namespace) ?? []), g])
  }

  const registeredActions = new Set<string>()
  for (const list of entityNamespaces.values()) for (const g of list) registeredActions.add(g.action)
  const actions = [
    ...STANDARD_ACTIONS.filter((a) => registeredActions.has(a)),
    ...[...registeredActions].filter((a) => !STANDARD_ACTIONS.includes(a)).sort(),
  ]

  const rows: GrantRow[] = [...entityNamespaces.entries()]
    .map(([namespace, list]) => {
      const cells: Record<string, GrantCell | null> = {}
      for (const action of actions) {
        const g = list.find((d) => d.action === action)
        cells[action] = g ? cellOf(g) : null
      }
      const wildcard = `${namespace}:*`
      return {
        namespace,
        entity: namespace.slice(namespace.indexOf(':') + 1),
        ownRecords: namespace.startsWith('entity-own:'),
        wildcard,
        wildcardOrigin: originOf(wildcard, permissions, inherited),
        cells,
      }
    })
    .sort((a, b) => a.entity.localeCompare(b.entity) || Number(a.ownRecords) - Number(b.ownRecords))

  const groups: GrantGroup[] = [...namedNamespaces.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, list]) => ({
      namespace,
      wildcard: `${namespace}:*`,
      wildcardOrigin: originOf(`${namespace}:*`, permissions, inherited),
      grants: list.map(cellOf),
    }))

  const registered = new Set(grants.map((g) => g.key))
  const shown = new Set([...rows.map((r) => r.wildcard), ...groups.map((g) => g.wildcard)])
  const keys = grants.map((g) => g.key)
  const others = [...new Set(permissions)]
    .filter((p) => !registered.has(p) && !shown.has(p))
    .map((key) => ({ key, covers: isWildcard(key) ? PermissionMatcher.expand(key, keys).length : 0 }))

  return { actions, rows, groups, others }
}

/** The role's own keys with one added or removed; the others keep their order. */
export function setGrant(permissions: readonly string[], key: string, on: boolean): string[] {
  if (on) return permissions.includes(key) ? [...permissions] : [...permissions, key]
  return permissions.filter((p) => p !== key)
}

/** What inheritedGrants needs from a roles provider: qdadm's RoleProvider has it. */
export interface RoleHierarchySource {
  getPermissions(role: string): string[]
  getHierarchy(): Record<string, string[]>
}

/**
 * What a role inherits, for apps whose front knows the roles (qdadm's own RoleProvider): each grant with the role
 * that declares it, the nearest one first across a chain. An app whose server judges sends this list instead.
 */
export function inheritedGrants(
  provider: RoleHierarchySource | null | undefined,
  inherits: readonly string[]
): InheritedGrant[] {
  if (!provider) return []
  const hierarchy = provider.getHierarchy() ?? {}
  const visited = new Set<string>()
  const known = new Set<string>()
  const out: InheritedGrant[] = []
  const queue = [...inherits]
  while (queue.length > 0) {
    const role = queue.shift()!
    if (visited.has(role)) continue
    visited.add(role)
    for (const permission of provider.getPermissions(role) ?? []) {
      if (known.has(permission)) continue
      known.add(permission)
      out.push({ permission, via: role })
    }
    queue.push(...(hierarchy[role] ?? []))
  }
  return out
}
