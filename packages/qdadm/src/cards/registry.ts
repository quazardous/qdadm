/**
 * The card types known to the app (#5339). qdadm registers its generic cards
 * (metric, queue, goal, bullet) when '@quazardous/qdadm' loads; an app adds
 * its own with registerCard().
 */
import { markRaw } from 'vue'
import type { CardDefinition, CardMeta } from './types'
import { validateCardData, type CardSchema, type SchemaProblem } from './validate'

const cards = new Map<string, CardDefinition>()

/** Register a card type: its body, its sheet and the schema of its data */
export function registerCard(definition: CardDefinition): void {
  const { type, meta } = definition
  if (!type) throw new Error('[qdadm] registerCard: a card needs a type')
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
  return [
    ...validateCardData(data, definition.schema, 'data'),
    ...validateCardData(options, optionsSchema(definition.meta), 'options'),
  ]
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
