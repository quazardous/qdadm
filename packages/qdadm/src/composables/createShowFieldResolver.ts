/**
 * createShowFieldResolver - shared read-only field resolver
 *
 * Factory producing the field resolver used by read-only display surfaces
 * (`useEntityItemShowPage`, `<ParentCard>`). Given an entity manager and the
 * orchestrator, it maps a raw schema field config to a resolved display config:
 *
 * - schema type → display type (via {@link SHOW_TYPE_MAPPINGS})
 * - auto reference route when a field points at another entity
 * - auto severity (badge) from the manager's severity maps
 *
 * Extracted so the parent cartouche of an embedded child list (#1038) renders
 * fields exactly like a real `ShowPage` — same resolver, same look — without
 * duplicating the mapping logic.
 */
import { snakeCaseToTitle } from './useFieldManager'

/** Severity descriptor returned by a manager's severity maps. */
type SeverityDescriptor = string | { severity: string; icon?: string; label?: string }

/**
 * Minimal manager surface the resolver needs — kept structural (not the full
 * generic `EntityManager`) so it accepts any concrete manager without variance
 * friction.
 */
export interface ShowResolverManager {
  routePrefix?: string
  idField: string
  hasSeverityMap?: (name: string) => boolean
  getSeverityDescriptor?: (name: string, value: string | number, fallback: string) => SeverityDescriptor
  getSeverity?: (name: string, value: string | number, fallback: string) => SeverityDescriptor
}

/**
 * Field definition from an EntityManager schema.
 */
export interface ShowFieldDefinition {
  name: string
  type?: string
  schemaType?: string
  label?: string
  /** Canonical FieldConfig object form, or the entity name as a bare string */
  reference?: string | { entity: string; labelField?: string; valueField?: string }
  referenceRoute?: string | ((value: unknown) => { name: string; params: Record<string, unknown> })
  referenceLabel?: string | ((value: unknown, option?: unknown) => string)
  options?: unknown[]
  optionLabel?: string
  optionValue?: string
  // Display options
  dateFormat?: string
  currencyCode?: string
  locale?: string
  booleanLabels?: { true: string; false: string }
  severity?: string | ((value: unknown) => string | { severity: string; icon?: string; label?: string })
  imageWidth?: string
  imageHeight?: string
  render?: (value: unknown) => string
  [key: string]: unknown
}

/**
 * Resolved field configuration for display rendering.
 */
export interface ShowResolvedFieldConfig extends ShowFieldDefinition {
  name: string
  type: string
  schemaType: string
  label: string
  group?: string
}

/**
 * Minimal orchestrator surface the resolver needs (reference-route lookup).
 */
export interface ShowResolverOrchestrator {
  get: (entityName: string) => ShowResolverManager | undefined
  /** Real Orchestrator.get THROWS on unknown entities — probe first when available */
  has?: (entityName: string) => boolean
}

/**
 * Schema type → display type mapping.
 */
export const SHOW_TYPE_MAPPINGS: Record<string, string> = {
  text: 'text',
  string: 'text',
  email: 'email',
  password: 'password',
  number: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  currency: 'currency',
  boolean: 'boolean',
  bool: 'boolean',
  date: 'date',
  datetime: 'datetime',
  time: 'datetime',
  timestamp: 'datetime',
  select: 'select',
  enum: 'select',
  textarea: 'textarea',
  longtext: 'textarea',
  reference: 'reference',
  foreignKey: 'reference',
  image: 'image',
  url: 'url',
  link: 'url',
  json: 'json',
  object: 'json',
  array: 'json',
  badge: 'badge',
  tag: 'badge',
}

/**
 * Build a show-style field resolver bound to a manager + orchestrator.
 */
export function createShowFieldResolver(
  manager: ShowResolverManager,
  orchestrator: ShowResolverOrchestrator
): (name: string, fieldConfig: Partial<ShowFieldDefinition>) => ShowResolvedFieldConfig {
  return function resolveFieldConfig(
    name: string,
    fieldConfig: Partial<ShowFieldDefinition>
  ): ShowResolvedFieldConfig {
    const {
      type = 'text',
      schemaType = type,
      label = '',
      reference = '',
      severity,
      ...rest
    } = fieldConfig

    let resolvedDisplayType = SHOW_TYPE_MAPPINGS[type] || SHOW_TYPE_MAPPINGS[schemaType] || 'text'
    const resolvedLabel = label || snakeCaseToTitle(name)

    // Auto-set reference route if reference entity is specified.
    // FieldConfig.reference is canonically { entity, ... }; the bare-string
    // form stays accepted. Passing the object to orchestrator.get produced
    // '[object Object]' lookups that THREW during generateFields (#1341).
    let referenceRoute = rest.referenceRoute
    if (reference && !referenceRoute) {
      const refEntity = typeof reference === 'string' ? reference : reference.entity
      const refManager =
        refEntity && (!orchestrator.has || orchestrator.has(refEntity))
          ? orchestrator.get(refEntity)
          : undefined
      if (refManager) {
        referenceRoute = (value: unknown) => ({
          name: `${refManager.routePrefix || refEntity}-show`,
          params: { [refManager.idField]: value },
        })
      }
    }

    // Auto-inject severity from manager's severity maps
    let resolvedSeverity = severity
    if (!resolvedSeverity && manager.hasSeverityMap?.(name)) {
      resolvedSeverity = manager.getSeverityDescriptor
        ? (value: unknown) => manager.getSeverityDescriptor!(name, value as string | number, 'secondary')
        : (value: unknown) => manager.getSeverity!(name, value as string | number, 'secondary')
      if (resolvedDisplayType === 'text') {
        resolvedDisplayType = 'badge'
      }
    }

    return {
      name,
      type: resolvedDisplayType,
      schemaType,
      label: resolvedLabel,
      reference,
      referenceRoute,
      severity: resolvedSeverity,
      ...rest,
    }
  }
}
