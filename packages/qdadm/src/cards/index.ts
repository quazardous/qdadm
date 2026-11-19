/**
 * Cards (#5337, #5339): the envelope, the registration of a card type with
 * its sheet and schema, the gallery, and qdadm's generic cards (metric,
 * queue, goal, bullet), registered when qdadm loads.
 */
import { registerBuiltinCards } from './builtin'

export { default as QdCard } from './QdCard.vue'
export { default as QdCardView } from './QdCardView.vue'
export { default as QdCardsGallery } from './QdCardsGallery.vue'
export { registerCard, getCard, listCards, checkCardInput, resolveCardOptions, optionsSchema } from './registry'
export { validateCardData, type CardSchema, type SchemaProblem } from './validate'
export { BUILTIN_CARDS } from './builtin'
export type {
  CardStatus,
  CardSize,
  CardState,
  CardAction,
  CardEnvelope,
  CardMeta,
  CardOptionSheet,
  CardDefinition,
  CardBodyProps,
} from './types'

registerBuiltinCards()
