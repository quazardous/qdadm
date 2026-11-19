/**
 * A card's data against its JSON Schema (#5339): the subset cards need, with
 * no dependency, so the browser and the node tooling share it.
 *
 * Supported: type (one or a list), enum, const, required, properties,
 * additionalProperties (false or a schema), items, minItems, maxItems,
 * minimum, maximum, minLength, maxLength, anyOf. Other keywords are ignored.
 */

export interface CardSchema {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  required?: string[]
  properties?: Record<string, CardSchema>
  additionalProperties?: boolean | CardSchema
  items?: CardSchema
  minItems?: number
  maxItems?: number
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  anyOf?: CardSchema[]
  title?: string
  description?: string
  default?: unknown
  [key: string]: unknown
}

export interface SchemaProblem {
  /** Where, as `data.items[0].age` */
  path: string
  message: string
}

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function matchesType(value: unknown, type: string): boolean {
  const actual = typeOf(value)
  if (type === 'number') return actual === 'number' || actual === 'integer'
  return actual === type
}

/** The problems of `value` against `schema`; empty when it fits */
export function validateCardData(value: unknown, schema: CardSchema, path = 'data'): SchemaProblem[] {
  const problems: SchemaProblem[] = []
  check(value, schema, path, problems)
  return problems
}

function check(value: unknown, schema: CardSchema, path: string, out: SchemaProblem[]): void {
  if (!schema || typeof schema !== 'object') return

  if (schema.anyOf) {
    const fits = schema.anyOf.some((s) => validateCardData(value, s, path).length === 0)
    if (!fits) out.push({ path, message: 'matches none of the allowed shapes' })
    return
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((t) => matchesType(value, t))) {
      out.push({ path, message: `expected ${types.join(' or ')}, got ${typeOf(value)}` })
      return
    }
  }
  if ('const' in schema && value !== schema.const) out.push({ path, message: `must be ${JSON.stringify(schema.const)}` })
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    out.push({ path, message: `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}` })
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) out.push({ path, message: `must be ≥ ${schema.minimum}` })
    if (schema.maximum !== undefined && value > schema.maximum) out.push({ path, message: `must be ≤ ${schema.maximum}` })
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) out.push({ path, message: `must have at least ${schema.minLength} characters` })
    if (schema.maxLength !== undefined && value.length > schema.maxLength) out.push({ path, message: `must have at most ${schema.maxLength} characters` })
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push({ path, message: `must have at least ${schema.minItems} items` })
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push({ path, message: `must have at most ${schema.maxItems} items` })
    if (schema.items) value.forEach((item, i) => check(item, schema.items!, `${path}[${i}]`, out))
    return
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) out.push({ path: `${path}.${key}`, message: 'is required' })
    }
    const props = schema.properties ?? {}
    for (const [key, sub] of Object.entries(props)) {
      if (record[key] !== undefined) check(record[key], sub, `${path}.${key}`, out)
    }
    if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
      for (const key of Object.keys(record)) {
        if (key in props) continue
        if (schema.additionalProperties === false) out.push({ path: `${path}.${key}`, message: 'is not allowed' })
        else check(record[key], schema.additionalProperties, `${path}.${key}`, out)
      }
    }
  }
}
