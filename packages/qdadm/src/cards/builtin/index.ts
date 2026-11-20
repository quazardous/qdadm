/**
 * qdadm's generic cards (#5339): no business in them, only shapes of data.
 * Each folder holds its sheet (meta.json), its schema (schema.json) and its
 * body; the node tooling reads the same files for the index and the bestiary.
 */
import { registerCard } from '../registry'
import type { CardMeta } from '../types'
import type { CardSchema } from '../validate'
import MetricCard from './metric/MetricCard.vue'
import metricMeta from './metric/meta.json'
import metricSchema from './metric/schema.json'
import QueueCard from './queue/QueueCard.vue'
import queueMeta from './queue/meta.json'
import queueSchema from './queue/schema.json'
import GoalCard from './goal/GoalCard.vue'
import goalMeta from './goal/meta.json'
import goalSchema from './goal/schema.json'
import BulletCard from './bullet/BulletCard.vue'
import bulletMeta from './bullet/meta.json'
import bulletSchema from './bullet/schema.json'
import CompareCard from './compare/CompareCard.vue'
import compareMeta from './compare/meta.json'
import compareSchema from './compare/schema.json'
import TrendCard from './trend/TrendCard.vue'
import trendMeta from './trend/meta.json'
import trendSchema from './trend/schema.json'
import RankingCard from './ranking/RankingCard.vue'
import rankingMeta from './ranking/meta.json'
import rankingSchema from './ranking/schema.json'
import SplitCard from './split/SplitCard.vue'
import splitMeta from './split/meta.json'
import splitSchema from './split/schema.json'
import FunnelCard from './funnel/FunnelCard.vue'
import funnelMeta from './funnel/meta.json'
import funnelSchema from './funnel/schema.json'
import HeatCard from './heat/HeatCard.vue'
import heatMeta from './heat/meta.json'
import heatSchema from './heat/schema.json'
import AgendaCard from './agenda/AgendaCard.vue'
import agendaMeta from './agenda/meta.json'
import agendaSchema from './agenda/schema.json'
import FeedCard from './feed/FeedCard.vue'
import feedMeta from './feed/meta.json'
import feedSchema from './feed/schema.json'
import FavoritesCard from './favorites/FavoritesCard.vue'
import favoritesMeta from './favorites/meta.json'
import favoritesSchema from './favorites/schema.json'
import RecentCard from './recent/RecentCard.vue'
import { PILLS } from './pills'
import recentMeta from './recent/meta.json'
import recentSchema from './recent/schema.json'

/** qdadm's card types, in the bestiary's order */
export const BUILTIN_CARDS = ['metric', 'queue', 'goal', 'bullet', 'compare', 'trend', 'ranking', 'split', 'funnel', 'heat', 'agenda', 'feed', 'favorites', 'recent'] as const

export function registerBuiltinCards(): void {
  registerCard({ type: 'metric', component: MetricCard, meta: metricMeta as CardMeta, schema: metricSchema as CardSchema, pill: PILLS.metric })
  registerCard({ type: 'queue', component: QueueCard, meta: queueMeta as CardMeta, schema: queueSchema as CardSchema, pill: PILLS.queue })
  registerCard({ type: 'goal', component: GoalCard, meta: goalMeta as CardMeta, schema: goalSchema as CardSchema, pill: PILLS.goal })
  registerCard({ type: 'bullet', component: BulletCard, meta: bulletMeta as CardMeta, schema: bulletSchema as CardSchema })
  registerCard({ type: 'compare', component: CompareCard, meta: compareMeta as CardMeta, schema: compareSchema as CardSchema, pill: PILLS.compare })
  registerCard({ type: 'trend', component: TrendCard, meta: trendMeta as CardMeta, schema: trendSchema as CardSchema })
  registerCard({ type: 'ranking', component: RankingCard, meta: rankingMeta as CardMeta, schema: rankingSchema as CardSchema })
  registerCard({ type: 'split', component: SplitCard, meta: splitMeta as CardMeta, schema: splitSchema as CardSchema, pill: PILLS.split })
  registerCard({ type: 'funnel', component: FunnelCard, meta: funnelMeta as CardMeta, schema: funnelSchema as CardSchema })
  registerCard({ type: 'heat', component: HeatCard, meta: heatMeta as CardMeta, schema: heatSchema as CardSchema })
  registerCard({ type: 'agenda', component: AgendaCard, meta: agendaMeta as CardMeta, schema: agendaSchema as CardSchema })
  registerCard({ type: 'feed', component: FeedCard, meta: feedMeta as CardMeta, schema: feedSchema as CardSchema })
  registerCard({ type: 'favorites', component: FavoritesCard, meta: favoritesMeta as CardMeta, schema: favoritesSchema as CardSchema })
  registerCard({ type: 'recent', component: RecentCard, meta: recentMeta as CardMeta, schema: recentSchema as CardSchema })
}
