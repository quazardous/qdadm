/**
 * The schema builder's reading of a JSON Schema (#5587): which lists make
 * sections, what an item's title and switch are, and how each property is
 * edited. Nothing here knows a business key: the structure is the schema's,
 * the rest comes from generic `x-…` annotations.
 *
 *   x-title: name          the item key drawn as the card's title
 *   x-enabled: enabled     the item key behind the card's switch (false written, true by default)
 *   x-section: false       a root list left out of the builder
 *   x-widget: <name>       a property edited by an app handler, or a built-in one
 *                          (conditions, keyTable, threshold, list)
 *   x-enumLabels           labels of an enum's values, or of a key table's keys
 *   x-qd-param: threshold  a string edited as `>= 20%`
 */
import { isSeq, parseDocument } from 'yaml'
import { addKey, setValue, type YamlPath } from '@quazardous/vanilla-yamleditor'
import { COMBINATORS, paramFromSchema, type ParamSpec, type RuleVocabulary, type TermSpec } from '../rules/vocabulary'

export type JsonSchema = Record<string, unknown>
const SERIALIZE = { lineWidth: 0, minContentWidth: 0 } as const
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** A `$ref` resolver over a root schema: `#/$defs/x`, `#/definitions/x`, any local JSON pointer */
export function resolverOf(root: unknown): (s: unknown) => JsonSchema {
  const base = isObj(root) ? root : {}
  const at = (ref: string): unknown => {
    if (!ref.startsWith('#')) return undefined
    let node: unknown = base
    for (const raw of ref.slice(1).split('/').filter(Boolean)) {
      const k = raw.replace(/~1/g, '/').replace(/~0/g, '~')
      node = isObj(node) ? node[k] : undefined
    }
    return node
  }
  return function resolve(s: unknown): JsonSchema {
    let node = s
    // A chain of refs, at most a few deep
    for (let i = 0; i < 8 && isObj(node) && typeof node.$ref === 'string'; i++) {
      const { $ref, ...rest } = node
      const target = at($ref as string)
      node = isObj(target) ? { ...target, ...rest } : rest
    }
    return isObj(node) ? node : {}
  }
}

/** The type a schema declares (first of a list) */
const typeOf = (s: JsonSchema): string | undefined => (Array.isArray(s.type) ? (s.type.find((t) => t !== 'null') as string | undefined) : (s.type as string | undefined))

export interface Section {
  key: string
  /** Where the list is in the document */
  path: YamlPath
  label: string
  /** The items' schema, resolved */
  items: JsonSchema
}

/** An array of objects: its items' schema, else null */
function objectItems(s: JsonSchema, resolve: (s: unknown) => JsonSchema): JsonSchema | null {
  if (typeOf(s) !== 'array' && !('items' in s)) return null
  const items = resolve(s.items)
  return typeOf(items) === 'object' || isObj(items.properties) ? items : null
}

/** The sections: the root list, or each root property that is a list of objects */
export function sectionsOf(schema: unknown): Section[] {
  const resolve = resolverOf(schema)
  const root = resolve(schema)
  const own = objectItems(root, resolve)
  if (own) return [{ key: '', path: [], label: typeof root.title === 'string' ? root.title : '', items: own }]
  const out: Section[] = []
  for (const [key, raw] of Object.entries(isObj(root.properties) ? root.properties : {})) {
    const p = resolve(raw)
    if (p['x-section'] === false) continue
    const items = objectItems(p, resolve)
    if (items) out.push({ key, path: [key], label: typeof p.title === 'string' ? p.title : key, items })
  }
  return out
}

export type FieldKind =
  | { kind: 'param'; param: ParamSpec }
  | { kind: 'keyTable'; keys: Array<{ value: string; label?: string }>; free: boolean; suggestions: string[] }
  | { kind: 'list'; item: ParamSpec }
  | { kind: 'object' }
  | { kind: 'conditions'; vocabulary: RuleVocabulary }
  | { kind: 'handler'; name: string }
  | { kind: 'raw' }

const BUILT_IN = ['conditions', 'keyTable', 'threshold', 'list'] as const

/**
 * How a property is edited, from its schema. `handlers` are the app's widget
 * names: an `x-widget` they hold wins over a built-in of the same name.
 */
export function fieldKind(raw: unknown, root: unknown, handlers: readonly string[] = []): FieldKind {
  const resolve = resolverOf(root)
  const s = resolve(raw)
  const widget = typeof s['x-widget'] === 'string' ? (s['x-widget'] as string) : null
  if (widget && handlers.includes(widget)) return { kind: 'handler', name: widget }
  if (widget === 'conditions') return { kind: 'conditions', vocabulary: { conditions: conditionTypes(s, resolve), actions: {} } }
  if (widget === 'threshold') return { kind: 'param', param: { type: 'threshold', ...(s['x-unit'] === '%' ? { unit: '%' as const } : {}) } }
  if (widget === 'keyTable') return keyTable(s, resolve)
  if (widget === 'list') return { kind: 'list', item: paramFromSchema(resolve(s.items)) }
  if (widget && !(BUILT_IN as readonly string[]).includes(widget)) return { kind: 'raw' }
  const type = typeOf(s)
  if (Array.isArray(s.enum) || s['x-qd-param'] === 'threshold') return { kind: 'param', param: paramFromSchema(s) }
  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') return { kind: 'param', param: paramFromSchema(s) }
  if (type === 'array') {
    const items = resolve(s.items)
    const t = typeOf(items)
    return t === 'string' || t === 'number' || t === 'integer' || Array.isArray(items.enum) ? { kind: 'list', item: paramFromSchema(items) } : { kind: 'raw' }
  }
  if (type === 'object' || isObj(s.properties) || isObj(s.propertyNames) || s.additionalProperties !== undefined) {
    // One key from a list and its threshold: the rule builder's keyed threshold
    if (s['x-qd-param'] === 'keyedThreshold' || (isObj(s.propertyNames) && s.maxProperties === 1)) return { kind: 'param', param: paramFromSchema(s) }
    if (isObj(s.properties) && Object.keys(s.properties).length) return { kind: 'object' }
    if (isObj(s.propertyNames) || isScalarMap(s, resolve)) return keyTable(s, resolve)
  }
  return { kind: 'raw' }
}

/** additionalProperties of a scalar type: a map of free keys to texts */
function isScalarMap(s: JsonSchema, resolve: (s: unknown) => JsonSchema): boolean {
  if (!isObj(s.additionalProperties)) return false
  const t = typeOf(resolve(s.additionalProperties))
  return t === 'string' || t === 'number' || t === 'integer'
}

function keyTable(s: JsonSchema, resolve: (s: unknown) => JsonSchema): FieldKind {
  const names = isObj(s.propertyNames) && Array.isArray(s.propertyNames.enum) ? (s.propertyNames.enum as unknown[]).map(String) : []
  const labels = (isObj(s['x-enumLabels']) ? s['x-enumLabels'] : {}) as Record<string, string>
  const values = isObj(s.additionalProperties) ? resolve(s.additionalProperties) : {}
  const suggestions = Array.isArray(values.examples) ? (values.examples as unknown[]).filter((v) => typeof v === 'string' || typeof v === 'number').map(String) : []
  return { kind: 'keyTable', keys: names.map((value) => (labels[value] ? { value, label: labels[value] } : { value })), free: !names.length, suggestions }
}

/**
 * The condition types an all / any tree may hold, read from its schema: every
 * object variant with one required key (not `all` / `any`), found through its
 * `oneOf` / `anyOf`, its refs and its groups' items.
 */
export function conditionTypes(node: JsonSchema, resolve: (s: unknown) => JsonSchema): Record<string, TermSpec> {
  const out: Record<string, TermSpec> = {}
  const seen = new Set<unknown>()
  const walk = (raw: unknown, depth: number): void => {
    if (depth > 8 || !isObj(raw) || seen.has(raw)) return
    seen.add(raw)
    if (typeof raw.$ref === 'string') {
      if (seen.has(raw.$ref)) return
      seen.add(raw.$ref)
    }
    const s = resolve(raw)
    for (const list of [s.oneOf, s.anyOf, s.allOf]) if (Array.isArray(list)) list.forEach((v) => walk(v, depth + 1))
    if (s.items) walk(s.items, depth + 1)
    const props = isObj(s.properties) ? s.properties : {}
    const required = Array.isArray(s.required) ? (s.required as string[]) : []
    const keys = Object.keys(props)
    const key = required.length === 1 ? required[0]! : keys.length === 1 ? keys[0]! : null
    if (key && (COMBINATORS as readonly string[]).includes(key)) {
      walk(props[key], depth + 1)
      return
    }
    if (key && props[key] !== undefined && !out[key]) {
      const p = resolve(props[key])
      const label = typeof s.title === 'string' ? s.title : typeof p.title === 'string' ? p.title : key
      out[key] = { label, ...(typeof s.description === 'string' ? { description: s.description } : {}), param: paramFromSchema(p) }
    }
    // A group's own combinators: their lists hold more conditions
    for (const c of COMBINATORS) if (props[c]) walk(props[c], depth + 1)
  }
  walk(node, 0)
  return out
}

/** A starting value for a property: its `default`, else one that fits its kind */
export function defaultFor(raw: unknown, root: unknown, handlers: readonly string[] = []): unknown {
  const s = resolverOf(root)(raw)
  if (s.default !== undefined) return s.default
  const k = fieldKind(raw, root, handlers)
  switch (k.kind) {
    case 'param':
      switch (k.param.type) {
        case 'text':
          return ''
        case 'number':
          return 0
        case 'boolean':
          return true
        case 'enum':
          return k.param.options[0]?.value ?? ''
        case 'threshold':
          return k.param.unit === '%' ? '>= 0%' : '>= 0'
        case 'keyedThreshold': {
          const first = k.param.keys[0]
          return first ? { [first.value]: first.unit === '%' ? '>= 0%' : '>= 0' } : {}
        }
      }
      return ''
    case 'list':
      return []
    case 'conditions':
      return { all: [] }
    case 'keyTable':
      return {}
    case 'object': {
      const props = isObj(s.properties) ? s.properties : {}
      const required = Array.isArray(s.required) ? (s.required as string[]) : []
      return Object.fromEntries(required.filter((r) => r in props).map((r) => [r, defaultFor(props[r], root, handlers)]))
    }
    default: {
      // A handler or a shape drawn as YAML: a value of its JSON type
      const type = typeOf(s)
      return type === 'string' ? '' : type === 'number' || type === 'integer' ? 0 : type === 'boolean' ? false : type === 'array' ? [] : type === 'object' ? {} : null
    }
  }
}

/** A new item: its schema's `default`, else its required keys, the title key named */
export function newItem(items: JsonSchema, root: unknown, title: string, handlers: readonly string[] = []): Record<string, unknown> {
  if (isObj(items.default)) return items.default
  const base = defaultFor({ ...items, type: 'object', default: undefined }, root, handlers) as Record<string, unknown>
  const key = typeof items['x-title'] === 'string' ? (items['x-title'] as string) : null
  return key ? { [key]: title, ...Object.fromEntries(Object.entries(base).filter(([k]) => k !== key)) } : base
}

/** Whether a value can be drawn by its kind; else the YAML, read-only */
export function fitsKind(k: FieldKind, value: unknown): boolean {
  switch (k.kind) {
    case 'list':
      return Array.isArray(value) && value.every((v) => v === null || typeof v !== 'object')
    case 'keyTable':
      return isObj(value) && Object.values(value).every((v) => v === null || typeof v !== 'object')
    case 'object':
      return isObj(value)
    case 'conditions':
      return isObj(value)
    case 'raw':
      return false
    default:
      return true
  }
}

/**
 * An item appended to the list at `seqPath`: in the list, or the list made
 * when it is missing (a key added to its map; on an empty document, the map)
 */
export function addListItem(text: string, seqPath: YamlPath, item: unknown): string {
  const doc = parseDocument(text, { keepSourceTokens: true })
  if (doc.errors.length) throw new Error(doc.errors[0]!.message)
  const node = seqPath.length ? doc.getIn(seqPath, true) : doc.contents
  if (isSeq(node)) {
    if (node.flow && !node.items.length) node.flow = false
    node.items.push(doc.createNode(item) as never)
    return doc.toString(SERIALIZE)
  }
  if (doc.contents == null || !seqPath.length) {
    // An empty document: the list, or the maps holding it
    let value: unknown = [item]
    for (let i = seqPath.length - 1; i >= 0; i--) value = { [String(seqPath[i])]: value }
    doc.contents = doc.createNode(value) as never
    return doc.toString(SERIALIZE)
  }
  const parent = seqPath.slice(0, -1)
  const last = seqPath[seqPath.length - 1]!
  let holder: unknown = doc.toJS()
  for (const k of parent) holder = isObj(holder) || Array.isArray(holder) ? (holder as Record<string, unknown>)[k as never] : undefined
  if (isObj(holder) && !(String(last) in holder)) return addKey(text, parent, String(last), [item])
  return setValue(text, seqPath, [item])
}
