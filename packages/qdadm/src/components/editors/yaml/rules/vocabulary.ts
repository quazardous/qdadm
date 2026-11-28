/**
 * A rule builder's vocabulary (#5581): the condition types and the actions a
 * rule may use, each with its label and its parameter.
 *
 * A rule, as the builder reads and writes it:
 *
 *   - name: prix d'achat invalide
 *     enabled: false                 # optional, true when absent
 *     when:
 *       all:                         # or any
 *         - channel: supplier.price  # a condition: one key, its type
 *         - any:                     # a nested group
 *             - measure: { refused: ">= 1000" }
 *     then:
 *       route: purchases.b2b         # an action: a key, its value
 */

export interface ParamChoice {
  value: string | number | boolean
  label?: string
}

/** A condition's or an action's value */
export type ParamSpec =
  /** `suggestions`: offered while typing, the text staying free (#5585) */
  | { type: 'text'; placeholder?: string; suggestions?: Array<string | ParamChoice> }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'enum'; options: ParamChoice[] }
  /** `">= 1000"`, `"< 20%"` */
  | { type: 'threshold'; unit?: '%' }
  /** A key chosen from a list, with its threshold, as a one-entry map: `{ refused_ratio: ">= 20%" }` */
  | { type: 'keyedThreshold'; keys: Array<{ value: string; label?: string; unit?: '%' }> }

export interface TermSpec {
  label: string
  description?: string
  param: ParamSpec
}

export interface RuleVocabulary {
  /** The condition types, by their key in the YAML */
  conditions: Record<string, TermSpec>
  /** The actions, by their key under `then` */
  actions: Record<string, TermSpec>
  /** A new rule, as added by « Add a rule » */
  template?: Record<string, unknown>
}

export const COMBINATORS = ['all', 'any'] as const
export type Combinator = (typeof COMBINATORS)[number]
export const OPERATORS = ['>=', '>', '<=', '<', '='] as const
export type Operator = (typeof OPERATORS)[number]

export interface Threshold {
  op: Operator
  value: number
  percent: boolean
}

const THRESHOLD = /^\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)\s*(%)?\s*$/

/** A threshold read from its text, or null when it is not one */
export function parseThreshold(text: unknown): Threshold | null {
  if (typeof text === 'number') return { op: '=', value: text, percent: false }
  if (typeof text !== 'string') return null
  const m = THRESHOLD.exec(text)
  return m ? { op: m[1] as Operator, value: Number(m[2]), percent: !!m[3] } : null
}

/** A threshold written: `">= 20%"` */
export function formatThreshold(t: Threshold): string {
  return `${t.op} ${t.value}${t.percent ? '%' : ''}`
}

/** A parameter's starting value, for a new condition or action */
export function defaultParam(param: ParamSpec): unknown {
  switch (param.type) {
    case 'text':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return true
    case 'enum':
      return param.options[0]?.value ?? ''
    case 'threshold':
      return param.unit === '%' ? '>= 0%' : '>= 0'
    case 'keyedThreshold': {
      const k = param.keys[0]
      return k ? { [k.value]: k.unit === '%' ? '>= 0%' : '>= 0' } : {}
    }
  }
}

/** Whether a value fits its parameter, so the builder can draw it; else the YAML, read-only */
export function fitsParam(param: ParamSpec, value: unknown): boolean {
  switch (param.type) {
    case 'text':
      return typeof value === 'string' || typeof value === 'number'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'enum':
      return param.options.some((o) => o.value === value || String(o.value) === String(value))
    case 'threshold':
      return parseThreshold(value) !== null
    case 'keyedThreshold': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const entries = Object.entries(value as Record<string, unknown>)
      return entries.length === 1 && param.keys.some((k) => k.value === entries[0]![0]) && parseThreshold(entries[0]![1]) !== null
    }
  }
}

// ── From a JSON Schema ───────────────────────────────────────────────────────
type Schema = Record<string, unknown>
const isObj = (v: unknown): v is Schema => !!v && typeof v === 'object' && !Array.isArray(v)

/** A parameter read from a property's schema, by the convention of docs/rule-builder.md */
export function paramFromSchema(s: Schema): ParamSpec {
  const marker = s['x-qd-param']
  const labels = (isObj(s['x-enumLabels']) ? s['x-enumLabels'] : isObj(s.enumLabels) ? s.enumLabels : {}) as Record<string, string>
  if (marker === 'keyedThreshold' || (s.type === 'object' && isObj(s.propertyNames) && Array.isArray(s.propertyNames.enum) && s.maxProperties === 1)) {
    const names = isObj(s.propertyNames) && Array.isArray(s.propertyNames.enum) ? (s.propertyNames.enum as string[]) : []
    const units = (isObj(s['x-units']) ? s['x-units'] : {}) as Record<string, string>
    return { type: 'keyedThreshold', keys: names.map((v) => ({ value: v, ...(labels[v] ? { label: labels[v] } : {}), ...(units[v] === '%' ? { unit: '%' as const } : {}) })) }
  }
  if (marker === 'threshold') return { type: 'threshold', ...(s['x-unit'] === '%' ? { unit: '%' as const } : {}) }
  if (Array.isArray(s.enum)) return { type: 'enum', options: (s.enum as ParamChoice['value'][]).map((v) => ({ value: v, ...(labels[String(v)] ? { label: labels[String(v)] } : {}) })) }
  if (s.type === 'number' || s.type === 'integer') return { type: 'number' }
  if (s.type === 'boolean') return { type: 'boolean' }
  // A string's examples: suggested, the text staying free (#5585)
  const examples = Array.isArray(s.examples) ? (s.examples as unknown[]).filter((v): v is string | number => typeof v === 'string' || typeof v === 'number') : []
  if (examples.length) return { type: 'text', suggestions: examples.map((v) => (labels[String(v)] ? { value: v, label: labels[String(v)] } : String(v))) }
  return { type: 'text' }
}

/**
 * A vocabulary from the rules' JSON Schema (#5581). The convention:
 * - the conditions are the `oneOf` of `$defs.condition` (or of the items of
 *   `when.all`): each an object with one required property, its key, whose
 *   schema is the parameter; its `title` is the label;
 * - the actions are the `properties` of the rules' `then`.
 * A parameter: an `enum` (labels in `x-enumLabels`), a number, a boolean, a
 * string with `x-qd-param: threshold`, a string with `examples` (suggested
 * while typing), or an object with one property drawn
 * from `propertyNames.enum` and `maxProperties: 1` (a keyed threshold; units
 * in `x-units`), else a text.
 */
export function vocabularyFromSchema(schema: unknown): RuleVocabulary {
  const root = isObj(schema) ? schema : {}
  const defs = (isObj(root.$defs) ? root.$defs : isObj(root.definitions) ? root.definitions : {}) as Schema
  const item = (isObj(root.items) ? root.items : root) as Schema
  const props = (isObj(item.properties) ? item.properties : {}) as Schema
  const resolve = (s: unknown): Schema => {
    if (!isObj(s)) return {}
    const ref = typeof s.$ref === 'string' ? s.$ref : null
    if (!ref) return s
    const name = ref.split('/').pop() ?? ''
    return isObj(defs[name]) ? (defs[name] as Schema) : {}
  }
  const condition = resolve(defs.condition ?? (isObj(props.when) ? (resolve(props.when).properties as Schema | undefined)?.all : undefined))
  const variants = (Array.isArray(condition.oneOf) ? condition.oneOf : Array.isArray(condition.anyOf) ? condition.anyOf : (isObj(condition.items) ? (resolve(condition.items).oneOf as unknown[]) : [])) ?? []
  const conditions: Record<string, TermSpec> = {}
  for (const raw of variants) {
    const v = resolve(raw)
    const keys = Object.keys((isObj(v.properties) ? v.properties : {}) as Schema)
    const key = (Array.isArray(v.required) ? (v.required[0] as string) : keys[0]) ?? null
    if (!key || (COMBINATORS as readonly string[]).includes(key)) continue
    const p = resolve((v.properties as Schema)[key])
    conditions[key] = { label: (typeof v.title === 'string' ? v.title : typeof p.title === 'string' ? p.title : key), ...(typeof v.description === 'string' ? { description: v.description } : {}), param: paramFromSchema(p) }
  }
  const then = resolve(props.then)
  const actions: Record<string, TermSpec> = {}
  for (const [key, raw] of Object.entries((isObj(then.properties) ? then.properties : {}) as Schema)) {
    const p = resolve(raw)
    actions[key] = { label: typeof p.title === 'string' ? p.title : key, ...(typeof p.description === 'string' ? { description: p.description } : {}), param: paramFromSchema(p) }
  }
  return { conditions, actions }
}
