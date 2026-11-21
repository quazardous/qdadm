/**
 * A dashboard block's links (#5405): `card: { links }` where the block is
 * declared reaches the card's foot, whatever component draws it.
 */
import type { InjectionKey, Ref } from 'vue'
import type { CardLink } from './types'

export const CARD_BLOCK_LINKS: InjectionKey<Ref<CardLink[]>> = Symbol('qdCardBlockLinks')
