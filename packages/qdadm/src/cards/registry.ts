/**
 * The card types known to the app (#5339). qdadm registers its generic cards
 * (metric, queue, goal, bullet) when '@quazardous/qdadm' loads; an app adds
 * its own with registerCard().
 */
import { defineComponent, h, markRaw, type PropType } from 'vue'
import type { CardDefinition, CardMeta, CardRegistration, CardSize } from './types'
import { validateCardData, type CardSchema, type SchemaProblem } from './validate'
import QdCardBlocks from './blocks/QdCardBlocks.vue'
import type { CardBlock } from './blocks/types'

const cards = new Map<string, CardDefinition>()

/** The body of a type declared by blocks (#5414): its data mapped, then drawn */
function assembly(type: string, toBlocks: NonNullable<CardDefinition['blocks']>) {
  return defineComponent({
    name: `QdCardAssembly_${type}`,
    props: {
      data: { type: null as unknown as PropType<unknown>, default: undefined },
      options: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
      size: { type: String as PropType<CardSize>, default: 's' },
    },
    setup(props) {
      return () => h('div', { class: 'qd-blocks' }, [h(QdCardBlocks, { blocks: toBlocks(props.data as never, props.options, props.size) as CardBlock[], size: props.size, check: true })])
    },
  })
}

/**
 * Register a card type: its body, its sheet and the schema of its data. The
 * body is a component, or `blocks(data, options, size)`: the data mapped to
 * the blocks it shows (#5414).
 */
export function registerCard(registration: CardRegistration): void {
  const { type, meta } = registration
  if (!type) throw new Error('[qdadm] registerCard: a card needs a type')
  if (!registration.component && typeof registration.blocks !== 'function') {
    throw new Error(`[qdadm] registerCard('${type}'): a card needs a component or blocks`)
  }
  const definition: CardDefinition = { ...registration, component: registration.component ?? assembly(type, registration.blocks!) }
  if (meta?.type && meta.type !== type) {
    console.warn(`[qdadm] registerCard('${type}'): its sheet says type '${meta.type}'`)
  }
  if (cards.has(type)) console.warn(`[qdadm] registerCard('${type}'): replaces the card already registered`)
  cards.set(type, { ...definition, component: markRaw(definition.component) })
}

export function getCard(type: string): CardDefinition | null {
  return cards.get(type) ?? null
}

/** Every registered type, in registration order */
export function listCards(): CardDefinition[] {
  return [...cards.values()]
}

/** The schema of a type's options, from its sheet */
export function optionsSchema(meta: CardMeta): CardSchema {
  return { type: 'object', properties: meta.options }
}

/** The problems of a card's data and options; empty when both fit */
export function checkCardInput(definition: CardDefinition, data: unknown, options: Record<string, unknown> = {}): SchemaProblem[] {
  const problems = [
    ...validateCardData(data, definition.schema, 'data'),
    ...validateCardData(options, optionsSchema(definition.meta), 'options'),
  ]
  // The type's own checks, on data that fits its schema
  if (!problems.length && definition.check) problems.push(...definition.check(data, options))
  return problems
}

/** The options with the sheet's defaults filled in */
export function resolveCardOptions(meta: CardMeta, options: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, sheet] of Object.entries(meta.options)) {
    if (sheet.default !== undefined) out[name] = sheet.default
  }
  return { ...out, ...options }
}

/** Tests only: forget the app's cards (qdadm's own stay) */
export function resetCards(keep: string[] = []): void {
  for (const type of [...cards.keys()]) if (!keep.includes(type)) cards.delete(type)
}
