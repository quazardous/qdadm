/**
 * QdDomainBoard (#5352): a domain's board of typed blocks on a grid of 12.
 */
import { registerBoardBlock } from './registry'
import { kpiSchema, breakdownSchema, topSchema, timelineSchema } from './blocks/schemas'
import KpiBlock from './blocks/KpiBlock.vue'
import BreakdownBlock from './blocks/BreakdownBlock.vue'
import TopBlock from './blocks/TopBlock.vue'
import TimelineBlock from './blocks/TimelineBlock.vue'

export { default as QdDomainBoard } from './QdDomainBoard.vue'
export { default as QdBoardBlock } from './QdBoardBlock.vue'
export { registerBoardBlock, getBoardBlock, listBoardBlocks, type BoardBlockType } from './registry'
export type { BoardBlock, BoardSource } from './types'

/** qdadm's block types */
export const BOARD_BLOCKS = ['kpi', 'breakdown', 'top', 'timeline'] as const

export function registerBuiltinBoardBlocks(): void {
  registerBoardBlock('kpi', { component: KpiBlock, schema: kpiSchema, span: 3 })
  registerBoardBlock('breakdown', {
    component: BreakdownBlock,
    schema: breakdownSchema,
    span: 5,
    isEmpty: (d) => !((d as { groups?: Array<{ rows: unknown[] }> })?.groups ?? []).some((g) => g.rows?.length),
  })
  registerBoardBlock('top', { component: TopBlock, schema: topSchema, span: 7, isEmpty: (d) => !((d as { rows?: unknown[] })?.rows ?? []).length })
  registerBoardBlock('timeline', { component: TimelineBlock, schema: timelineSchema, span: 12, isEmpty: (d) => !((d as { points?: unknown[] })?.points ?? []).length })
}

registerBuiltinBoardBlocks()
