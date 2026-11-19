/**
 * The data each built-in block type draws (#5352), as JSON Schemas in the
 * cards' subset: data that does not fit draws the block as invalid.
 */
import type { CardSchema } from '../../cards/validate'

const route: CardSchema = { type: ['string', 'object'], description: 'A route to open' }
const STATUS = ['critical', 'watch', 'good', 'info']

export const kpiSchema: CardSchema = {
  type: 'object',
  required: ['label', 'value'],
  additionalProperties: false,
  properties: {
    label: { type: 'string' },
    value: { type: ['number', 'string'] },
    unit: { type: 'string' },
    decimals: { type: 'integer', minimum: 0, maximum: 6 },
    note: { type: 'string' },
    status: { type: 'string', enum: STATUS },
    to: route,
  },
}

export const breakdownSchema: CardSchema = {
  type: 'object',
  required: ['groups'],
  additionalProperties: false,
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rows'],
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'value'],
              additionalProperties: false,
              properties: { label: { type: 'string' }, value: { type: 'number', minimum: 0 }, to: route },
            },
          },
        },
      },
    },
    note: { type: 'string' },
  },
}

export const topSchema: CardSchema = {
  type: 'object',
  required: ['columns', 'rows'],
  additionalProperties: false,
  properties: {
    columns: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['key', 'label'],
        additionalProperties: false,
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['text', 'mono', 'tags', 'number', 'spark'] },
        },
      },
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['values'],
        additionalProperties: false,
        properties: {
          values: { type: 'object' },
          to: route,
        },
      },
    },
  },
}

export const timelineSchema: CardSchema = {
  type: 'object',
  required: ['points'],
  additionalProperties: false,
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object',
        required: ['at', 'value'],
        additionalProperties: false,
        properties: { at: { type: ['string', 'number'] }, value: { type: 'number', minimum: 0 } },
      },
    },
    bucket: { type: 'string', enum: ['day', 'hour'], description: 'One bar per day (default) or per hour' },
    label: { type: 'string', description: 'What is counted: "loans"' },
    previous: { type: 'number', minimum: 0, description: 'The total of the period before, for the change' },
    higherIs: { type: 'string', enum: ['better', 'worse', 'neutral'] },
  },
}
