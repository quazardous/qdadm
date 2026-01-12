/**
 * Decorators Layer
 *
 * Applies per-entity field customizations to UnifiedEntitySchema.
 * Decorators allow overriding field properties (hidden, label, readonly, order)
 * without modifying the base schema from connectors.
 *
 * @module gen/decorators
 */

import type { UnifiedEntitySchema, UnifiedFieldSchema } from './schema'

/**
 * Allowed decorator properties for field overrides.
 * Unknown properties will trigger a console warning.
 */
const ALLOWED_FIELD_DECORATORS = ['hidden', 'label', 'readOnly', 'order'] as const

type AllowedFieldDecoratorKey = (typeof ALLOWED_FIELD_DECORATORS)[number]

/**
 * Field Decorator Configuration
 *
 * Per-field overrides that can be applied to schema fields.
 */
export interface FieldDecorator {
  /** Override field visibility */
  hidden?: boolean
  /** Override field label */
  label?: string
  /** Override field read-only state */
  readOnly?: boolean
  /** Override field display order */
  order?: number
}

/**
 * Entity Decorator Configuration
 *
 * Decorator configuration for a single entity.
 */
export interface EntityDecorator {
  /** Field-level overrides keyed by field name */
  fields?: Record<string, FieldDecorator>
}

/**
 * Apply decorators to a UnifiedEntitySchema
 *
 * Takes a schema and decorator configuration, returns a new schema with
 * decorator properties merged onto matching fields. Original schema is
 * not mutated.
 *
 * @param schema - Original entity schema
 * @param decoratorConfig - Decorator configuration
 * @returns New schema with decorators applied
 *
 * @example
 * // Hide email field and rename created_at
 * const decorated = applyDecorators(usersSchema, {
 *   fields: {
 *     email: { hidden: true },
 *     created_at: { label: 'Member Since', readOnly: true }
 *   }
 * })
 *
 * @example
 * // Set field display order
 * const ordered = applyDecorators(postsSchema, {
 *   fields: {
 *     title: { order: 1 },
 *     body: { order: 2 },
 *     author_id: { order: 3 }
 *   }
 * })
 */
export function applyDecorators(
  schema: UnifiedEntitySchema,
  decoratorConfig?: EntityDecorator
): UnifiedEntitySchema {
  // No decorators - return schema as-is (still immutable reference)
  if (!decoratorConfig || !decoratorConfig.fields) {
    return schema
  }

  const { fields: fieldDecorators } = decoratorConfig

  // Build new fields object with decorators applied
  const decoratedFields: Record<string, UnifiedFieldSchema> = {}

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const decorator = fieldDecorators[fieldName]

    if (!decorator) {
      // No decorator for this field - copy as-is
      decoratedFields[fieldName] = { ...fieldSchema }
      continue
    }

    // Validate decorator properties
    for (const key of Object.keys(decorator)) {
      if (!(ALLOWED_FIELD_DECORATORS as readonly string[]).includes(key)) {
        console.warn(
          `[qdadm] Unknown decorator property "${key}" for field "${fieldName}" in entity "${schema.name}". Allowed: ${ALLOWED_FIELD_DECORATORS.join(', ')}`
        )
      }
    }

    // Merge decorator properties onto field (only allowed properties)
    const decoratedField: UnifiedFieldSchema = { ...fieldSchema }
    for (const key of ALLOWED_FIELD_DECORATORS) {
      if (key in decorator) {
        ;(decoratedField as Record<string, unknown>)[key] = decorator[key as AllowedFieldDecoratorKey]
      }
    }

    decoratedFields[fieldName] = decoratedField
  }

  // Warn about decorators for non-existent fields
  for (const fieldName of Object.keys(fieldDecorators)) {
    if (!(fieldName in schema.fields)) {
      console.warn(
        `[qdadm] Decorator defined for unknown field "${fieldName}" in entity "${schema.name}". Available fields: ${Object.keys(schema.fields).join(', ')}`
      )
    }
  }

  // Return new schema with decorated fields
  return {
    ...schema,
    fields: decoratedFields,
  }
}
