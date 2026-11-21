/**
 * The JSON Schema of each block (#5414), and the check of a list of blocks:
 * each one against the schema of its kind, so a problem names its field.
 */
import { validateCardData, type CardSchema, type SchemaProblem } from '../validate'

const route: CardSchema = { type: ['string', 'object'], description: 'A route' }
const tone: CardSchema = { type: 'string', enum: ['critical', 'watch', 'good', 'info', 'neutral'] }
const status: CardSchema = { type: 'string', enum: ['critical', 'watch', 'good', 'info'] }
const time: CardSchema = { type: ['string', 'number'], description: 'An ISO date or a timestamp' }

const point: CardSchema = {
  anyOf: [
    { type: 'number' },
    { type: 'array', minItems: 2, maxItems: 2, items: { type: ['string', 'number'] } },
    {
      type: 'object',
      required: ['v'],
      additionalProperties: false,
      properties: { t: time, v: { type: 'number' }, low: { type: 'number' }, high: { type: 'number' } },
    },
  ],
}

export const BLOCK_SCHEMAS: Record<string, CardSchema> = {
  value: {
    type: 'object',
    required: ['kind', 'value'],
    additionalProperties: false,
    properties: {
      kind: { const: 'value' },
      value: { type: 'number' },
      unit: { type: 'string' },
      decimals: { type: 'integer', minimum: 0, maximum: 4 },
      label: { type: 'string' },
      badge: { type: 'string' },
      delta: {
        type: 'object',
        required: ['value'],
        additionalProperties: false,
        properties: { value: { type: 'number' }, period: { type: 'string' } },
      },
      higherIs: { type: 'string', enum: ['better', 'worse', 'neutral'] },
      then: {
        type: 'object',
        required: ['value'],
        additionalProperties: false,
        properties: { value: { type: 'number' }, label: { type: 'string' } },
      },
      changeAs: { type: 'string', enum: ['points', 'percent'] },
    },
  },
  viz: {
    type: 'object',
    required: ['kind', 'series'],
    additionalProperties: false,
    properties: {
      kind: { const: 'viz' },
      // line, area, bars, stacked, or a chart the app registered (#5441)
      chart: { type: 'string', minLength: 1 },
      stacked: { type: 'boolean' },
      series: {
        type: 'array',
        items: {
          anyOf: [
            { type: 'number' },
            {
              type: 'object',
              required: ['points'],
              additionalProperties: false,
              properties: {
                label: { type: 'string' },
                points: { type: 'array', items: point },
                tone: { type: ['string', 'integer'] },
              },
            },
          ],
        },
      },
      period: { type: 'string', enum: ['24h', '7d', '30d'] },
      warning: { type: 'number' },
      critical: { type: 'number' },
      normal: {
        type: 'object',
        required: ['low', 'high'],
        additionalProperties: false,
        properties: { low: { type: 'number' }, high: { type: 'number' } },
      },
      unit: { type: 'string' },
      decimals: { type: 'integer', minimum: 0, maximum: 4 },
      compact: { type: 'boolean' },
      dot: { type: 'boolean' },
      label: { type: 'string' },
    },
  },
  list: {
    type: 'object',
    required: ['kind', 'items'],
    additionalProperties: false,
    properties: {
      kind: { const: 'list' },
      look: { type: 'string', enum: ['hot', 'queue', 'feed', 'ranking'] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label'],
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            to: route,
            tag: { type: 'string' },
            tagStatus: status,
            at: time,
            status,
            value: { type: 'number' },
            age: { type: 'number', minimum: 0 },
            due: { type: 'number', minimum: 0 },
            action: {
              type: 'object',
              required: ['verb', 'to'],
              additionalProperties: false,
              properties: { verb: { type: 'string' }, to: route },
            },
          },
        },
      },
      max: { type: 'integer', minimum: 1 },
      more: { type: 'boolean' },
      now: time,
      ageUnit: { type: 'string', enum: ['min', 'h', 'd'] },
      unit: { type: 'string' },
      bars: { type: 'boolean' },
    },
  },
  text: {
    type: 'object',
    required: ['kind', 'text'],
    additionalProperties: false,
    properties: { kind: { const: 'text' }, text: { type: 'string' }, look: { type: 'string', enum: ['note', 'reading'] }, tone, strong: { type: 'string' } },
  },
  progress: {
    type: 'object',
    required: ['kind', 'value'],
    additionalProperties: false,
    properties: {
      kind: { const: 'progress' },
      look: { type: 'string', enum: ['goal', 'bullet'] },
      value: { type: 'number' },
      target: { type: 'number' },
      start: { type: 'string' },
      due: { type: 'string' },
      now: { type: 'string' },
      thresholds: { type: 'array', items: { type: 'number' } },
      min: { type: 'number' },
      max: { type: 'number' },
      higherIs: { type: 'string', enum: ['better', 'worse'] },
      unit: { type: 'string' },
      decimals: { type: 'integer', minimum: 0, maximum: 4 },
    },
  },
  parts: {
    type: 'object',
    required: ['kind', 'parts'],
    additionalProperties: false,
    properties: {
      kind: { const: 'parts' },
      parts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label', 'value'],
          additionalProperties: false,
          properties: { label: { type: 'string' }, value: { type: 'number', minimum: 0 }, to: route },
        },
      },
      max: { type: 'integer', minimum: 1 },
      unit: { type: 'string' },
    },
  },
}

const level: CardSchema = { type: 'string', enum: ['info', 'warning', 'critical'] }
BLOCK_SCHEMAS.flash = {
  type: 'object',
  required: ['kind'],
  additionalProperties: false,
  properties: {
    kind: { const: 'flash' },
    place: { type: 'string', enum: ['top', 'bottom'] },
    messages: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['level', 'text'],
        additionalProperties: false,
        properties: { level, text: { type: 'string', minLength: 1 }, to: route },
      },
    },
    level,
    text: { type: 'string', minLength: 1 },
    to: route,
    dismissible: { type: 'boolean' },
    id: { type: 'string' },
  },
}

export const BLOCK_KINDS = Object.keys(BLOCK_SCHEMAS)

/** A list of blocks, as a card's data takes it */
export const BLOCKS_SCHEMA: CardSchema = {
  type: 'array',
  items: { type: 'object', required: ['kind'], properties: { kind: { type: 'string', enum: BLOCK_KINDS } } },
}

/** The problems of one block; empty when it fits its kind */
export function checkBlock(block: unknown, path = 'block'): SchemaProblem[] {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return [{ path, message: 'a block is an object with a kind' }]
  const kind = (block as { kind?: unknown }).kind
  const schema = typeof kind === 'string' ? BLOCK_SCHEMAS[kind] : undefined
  if (!schema) return [{ path: `${path}.kind`, message: `no block kind '${String(kind)}' (one of ${BLOCK_KINDS.join(', ')})` }]
  const problems = validateCardData(block, schema, path)
  // A flash says something: its messages, or one text with its level
  if (!problems.length && kind === 'flash') {
    const f = block as { messages?: unknown[]; text?: unknown; level?: unknown }
    if (!f.messages && (typeof f.text !== 'string' || typeof f.level !== 'string')) problems.push({ path, message: 'a flash needs messages, or a text and its level' })
  }
  return problems
}

/** The problems of a list of blocks */
export function checkBlocks(blocks: unknown, path = 'blocks'): SchemaProblem[] {
  if (!Array.isArray(blocks)) return [{ path, message: 'blocks are an array' }]
  return blocks.flatMap((b, i) => checkBlock(b, `${path}[${i}]`))
}
