/**
 * A dashboard block's links (#5405): `card: { links }` where the block is
 * declared reaches the card's foot, whatever component draws it.
 */
import type { InjectionKey, Ref } from 'vue'
import type { CardLink } from './types'
import type { CardBlock } from './blocks/types'

export const CARD_BLOCK_LINKS: InjectionKey<Ref<CardLink[]>> = Symbol('qdCardBlockLinks')

/** A dashboard block's `card: { blocks }` (#5414): drawn under the card's body */
export const CARD_BLOCK_BLOCKS: InjectionKey<Ref<CardBlock[]>> = Symbol('qdCardBlockBlocks')
