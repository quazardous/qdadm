/**
 * Where a card's flash blocks go (#5414): QdCard gathers them from its body,
 * whatever their place in a list of blocks, and draws them at theirs (under
 * the header, or above the foot).
 */
import type { InjectionKey } from 'vue'
import type { FlashBlock } from './types'

export interface CardFlashes {
  set: (owner: symbol, blocks: FlashBlock[]) => void
  drop: (owner: symbol) => void
}

export const CARD_FLASHES: InjectionKey<CardFlashes> = Symbol('qdCardFlashes')
