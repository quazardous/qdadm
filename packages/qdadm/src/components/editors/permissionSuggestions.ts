/**
 * What PermissionEditor suggests while a permission is typed (#5333)
 *
 * Keys are `namespace:action`, the namespace of any depth (`auth:impersonate`,
 * `entity:books:read`, `logs:errors:read`). Wildcards follow PermissionMatcher:
 * `*` is one segment, `**` any number of them, anywhere in the pattern.
 *
 * - `` → the first segments, `**` (all) and `**:` (an action everywhere)
 * - `entity:` → its next segments, and its wildcards: `entity:**`,
 *   `entity:*` (its direct permissions), `entity:*:read`, `entity:**:read`
 * - anything with a `*` → the wildcards starting with it
 */

export interface Permission {
  key: string
  namespace: string
  action: string
  label: string
}

export interface PermissionRegistry {
  getAll(): Permission[]
  get(key: string): Permission | undefined
}

export interface Suggestion {
  label: string
  value: string
  type: 'namespace' | 'permission' | 'wildcard' | 'wildcard-action'
  description: string
}

/** The texts of the suggestions, from the catalogue */
export interface SuggestionTexts {
  all: () => string
  actionEverywhere: (action: string) => string
  anActionEverywhere: () => string
  allUnder: (prefix: string) => string
  directUnder: (prefix: string) => string
  actionUnder: (action: string, prefix: string) => string
  subItems: (count: number) => string
  label: (key: string) => string
}

/** A registry from a plain list of keys: namespace and action cut at the last `:` */
export function permissionRegistryFromList(keys: string[], label: (key: string) => string = (k) => k): PermissionRegistry {
  const list: Permission[] = [...new Set(keys.filter((k) => typeof k === 'string' && k !== ''))].map((key) => {
    const at = key.lastIndexOf(':')
    return { key, namespace: at > 0 ? key.slice(0, at) : '', action: at >= 0 ? key.slice(at + 1) : key, label: label(key) }
  })
  const byKey = new Map(list.map((p) => [p.key, p]))
  return { getAll: () => list, get: (key) => byKey.get(key) }
}

/** Every wildcard the keys make sense of, with what it covers */
export function wildcardCandidates(keys: string[], texts: SuggestionTexts): Suggestion[] {
  const out = new Map<string, Suggestion>()
  const add = (value: string, type: Suggestion['type'], description: string) => {
    if (!out.has(value)) out.set(value, { label: value, value, type, description })
  }
  const split = keys.map((k) => k.split(':'))
  const actions = [...new Set(split.map((parts) => parts[parts.length - 1]!))].sort()

  add('**', 'wildcard', texts.all())
  for (const action of actions) add(`**:${action}`, 'wildcard-action', texts.actionEverywhere(action))

  // Two-part keys: `*:read` covers them all
  if (split.some((parts) => parts.length === 2)) {
    for (const action of [...new Set(split.filter((p) => p.length === 2).map((p) => p[1]!))].sort()) {
      add(`*:${action}`, 'wildcard-action', texts.actionUnder(action, '*'))
    }
  }

  // Each namespace prefix and what lies under it
  const prefixes = new Set<string>()
  for (const parts of split) for (let i = 1; i < parts.length; i++) prefixes.add(parts.slice(0, i).join(':'))
  for (const prefix of [...prefixes].sort()) {
    const depth = prefix.split(':').length
    const under = split.filter((parts) => parts.length > depth && parts.slice(0, depth).join(':') === prefix)
    add(`${prefix}:**`, 'wildcard', texts.allUnder(prefix))
    if (under.some((parts) => parts.length === depth + 1)) add(`${prefix}:*`, 'wildcard', texts.directUnder(prefix))
    for (const parts of under) {
      const action = parts[parts.length - 1]!
      if (parts.length === depth + 2) add(`${prefix}:*:${action}`, 'wildcard-action', texts.actionUnder(action, prefix))
      if (parts.length > depth + 2) add(`${prefix}:**:${action}`, 'wildcard-action', texts.actionUnder(action, prefix))
    }
  }
  return [...out.values()]
}

/** The suggestions for what is typed, at most `limit` */
export function suggestPermissions(query: string, keys: string[], texts: SuggestionTexts, limit = 20): Suggestion[] {
  const lower = query.toLowerCase()
  const wildcards = () => wildcardCandidates(keys, texts)

  // A wildcard being typed: the wildcards it starts
  if (query.includes('*')) {
    const results = wildcards().filter((s) => s.value.toLowerCase().startsWith(lower))
    if (query === '**' || query.startsWith('**:')) return results.slice(0, limit)
    return results.sort((a, b) => a.value.length - b.value.length || a.value.localeCompare(b.value)).slice(0, limit)
  }

  const results: Suggestion[] = []
  const prefixes = new Set<string>()
  for (const key of keys) {
    const parts = key.split(':')
    for (let i = 1; i <= parts.length; i++) prefixes.add(parts.slice(0, i).join(':'))
  }
  const isKey = (p: string) => keys.includes(p)
  const count = (p: string) => [...prefixes].filter((x) => x.startsWith(`${p}:`)).length

  for (const prefix of [...prefixes].sort()) {
    if (!prefix.toLowerCase().startsWith(lower) || prefix.toLowerCase() === lower) continue
    // Complete up to the next `:` past what is typed
    const next = prefix.indexOf(':', query.length)
    const value = next > -1 ? prefix.slice(0, next + 1) : isKey(prefix) ? prefix : `${prefix}:`
    if (results.some((r) => r.value === value)) continue
    const namespace = value.endsWith(':')
    results.push({
      label: value,
      value,
      type: namespace ? 'namespace' : 'permission',
      description: namespace ? texts.subItems(count(value.slice(0, -1))) : texts.label(value),
    })
  }
  results.sort((a, b) => (a.type === b.type ? a.label.localeCompare(b.label) : a.type === 'namespace' ? -1 : 1))

  // The wildcards of this level: `**` at the start, `entity:**`… after a namespace
  let levelWildcards: Suggestion[] = []
  if (query === '') {
    levelWildcards = [
      { label: '**', value: '**', type: 'wildcard', description: texts.all() },
      { label: '**:', value: '**:', type: 'namespace', description: texts.anActionEverywhere() },
    ]
  } else if (query.endsWith(':')) {
    levelWildcards = wildcards().filter((s) => s.value.startsWith(query) && s.value.slice(query.length).startsWith('*'))
  }
  return [...levelWildcards, ...results].slice(0, limit)
}
