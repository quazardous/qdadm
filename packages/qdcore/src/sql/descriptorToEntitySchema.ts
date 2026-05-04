/**
 * descriptorToEntitySchema — convert our agnostic EntityDescriptor into a
 * MikroORM `EntitySchema` ready to feed to a MikroORM instance.
 *
 * The conversion is one-way and stateless. It maps:
 * - our portable {@link EntityFieldType} → MikroORM column type strings
 * - `pk`, `unique`, `nullable`, `default`, `length`, `fk`, `onDelete` → MikroORM property options
 * - our `EntityIndexConfig[]` → MikroORM `indexes` schema option
 *
 * Owner stamps (`field.owner`, `entity.owner`) are NOT carried into MikroORM
 * — MikroORM does not have a notion of column ownership. The OwnershipTracker
 * keeps that info on our side and is consulted at uninstall planning.
 */

import { EntitySchema, type EntitySchemaProperty } from '@mikro-orm/core'
import type {
  EntityDescriptor,
  EntityFieldConfig,
  EntityFieldType,
} from '../entity/types'

/**
 * MikroORM column type strings. Kept as strings (not enum) to follow
 * MikroORM convention; the values must match what the dialect helpers
 * recognise.
 */
const TYPE_MAP: Record<EntityFieldType, string> = {
  uuid: 'uuid',
  string: 'string',
  text: 'text',
  integer: 'integer',
  bigint: 'bigint',
  float: 'float',
  boolean: 'boolean',
  json: 'json',
  date: 'date',
  datetime: 'datetime',
  timestamp: 'datetime', // MikroORM uses `datetime` for timestamps; precision differs by dialect
}

export function descriptorToEntitySchema(
  descriptor: EntityDescriptor,
): EntitySchema {
  const properties: Record<string, EntitySchemaProperty<unknown, unknown>> = {}

  for (const [fieldName, field] of Object.entries(descriptor.fields)) {
    properties[fieldName] = fieldToProperty(fieldName, field)
  }

  return new EntitySchema({
    name: descriptor.name,
    tableName: descriptor.tableName,
    properties,
    indexes: (descriptor.indexes ?? []).map((idx) => ({
      properties: idx.fields,
      name: idx.name,
      // MikroORM differentiates index vs unique-index via the schema option
      // `indexes` vs `uniques`. Easiest path: emit unique indexes via the
      // `unique` flag at column-level when single-column; multi-column
      // unique must use the schema-level `uniques` array. For Phase 1b
      // we only emit non-unique indexes here; uniques live on the field
      // (`unique: true`) for now.
    })),
  })
}

function fieldToProperty(
  name: string,
  field: EntityFieldConfig,
): EntitySchemaProperty<unknown, unknown> {
  const dbType = field.dbType ?? TYPE_MAP[field.type]
  // MikroORM's primitive `type` distinguishes JS-side vs DB-side. For our
  // simple use-case we let MikroORM pick the JS type from `columnType`,
  // and we set `columnType` directly via `type`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prop: any = {
    type: dbType,
    primary: field.pk ?? false,
    nullable: field.nullable ?? false,
    unique: field.unique ?? undefined,
    fieldName: name,
  }
  if (field.length !== undefined) prop.length = field.length
  if (field.default !== undefined) {
    // MikroORM accepts `default` (literal) and `defaultRaw` (raw SQL). We
    // map our string shorthand `'now'` to a dialect-portable raw default.
    if (field.default === 'now') {
      prop.defaultRaw = 'CURRENT_TIMESTAMP'
    } else {
      prop.default = field.default
    }
  }
  if (field.fk) {
    // MikroORM models FKs via reference relations. For our minimal Phase 1
    // we keep FK as a column constraint via `kind: 'scalar' + foreignKey`,
    // which MikroORM sql layer translates to ALTER TABLE ADD CONSTRAINT.
    // Fully relational FKs (with reference loading) come later when the
    // entity layer gets relation descriptors.
    const [refTable, refColumn] = field.fk.split('.')
    prop.foreignKey = {
      referencedTableName: refTable,
      referencedColumnNames: [refColumn ?? 'id'],
      deleteRule: field.onDelete,
      updateRule: field.onUpdate,
    }
  }
  return prop as EntitySchemaProperty<unknown, unknown>
}

/**
 * Convenience: convert many descriptors at once. Order is preserved
 * (relevant for FK creation where parent must be created first — caller's
 * responsibility to order).
 */
export function descriptorsToEntitySchemas(
  descriptors: EntityDescriptor[],
): EntitySchema[] {
  return descriptors.map(descriptorToEntitySchema)
}
