/**
 * QdDomainBoard's block types (#5352): kpi, breakdown, top, timeline, and the
 * app's own. A type is a component drawing `data`, the JSON Schema `data`
 * must fit, its default span on the grid of 12, and when its data counts as
 * empty.
 */
import type { Component } from 'vue'
import type { CardSchema } from '../cards/validate'

export interface BoardBlockType {
  type: string
  component: Component
  schema: CardSchema
  /** Columns of 12 it takes by default */
  span: number
  /** Nothing to show: the block draws its empty state instead */
  isEmpty?: (data: unknown) => boolean
}

const types = new Map<string, BoardBlockType>()

/** Add a block type, or replace one */
export function registerBoardBlock(type: string, def: Omit<BoardBlockType, 'type'>): void {
  types.set(type, { ...def, type })
}

export function getBoardBlock(type: string): BoardBlockType | undefined {
  return types.get(type)
}

export function listBoardBlocks(): BoardBlockType[] {
  return [...types.values()]
}
