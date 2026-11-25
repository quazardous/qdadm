/**
 * A dashboard block's links (#5405): `card: { links }` where the block is
 * declared reaches the card's foot, whatever component draws it.
 */
import { inject, ref, type InjectionKey, type Ref } from 'vue'
import type { CardLink } from './types'
import type { CardBlock } from './blocks/types'

export const CARD_BLOCK_LINKS: InjectionKey<Ref<CardLink[]>> = Symbol('qdCardBlockLinks')

/** A dashboard block's `card: { blocks }` (#5414): drawn under the card's body */
export const CARD_BLOCK_BLOCKS: InjectionKey<Ref<CardBlock[]>> = Symbol('qdCardBlockBlocks')

/**
 * The size of the dashboard slot a card is drawn in (#5503), width × height:
 * a card two rows high may show more. Null outside a dashboard.
 */
export const CARD_SLOT_SIZE: InjectionKey<Ref<{ w: number; h: number } | null>> = Symbol('qdCardSlotSize')

/** The dashboard slot's size, for a card's body: `{ w, h }`, or null outside a dashboard */
export function useCardSlotSize(): Ref<{ w: number; h: number } | null> {
  return inject(CARD_SLOT_SIZE, ref(null))
}
