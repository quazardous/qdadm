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
import FavoritesCard from './favorites/FavoritesCard.vue'
import favoritesMeta from './favorites/meta.json'
import favoritesSchema from './favorites/schema.json'
import RecentCard from './recent/RecentCard.vue'
import recentMeta from './recent/meta.json'
import recentSchema from './recent/schema.json'

/** qdadm's card types, in the bestiary's order */
export const BUILTIN_CARDS = ['metric', 'queue', 'goal', 'bullet', 'favorites', 'recent'] as const

export function registerBuiltinCards(): void {
  registerCard({ type: 'metric', component: MetricCard, meta: metricMeta as CardMeta, schema: metricSchema as CardSchema })
  registerCard({ type: 'queue', component: QueueCard, meta: queueMeta as CardMeta, schema: queueSchema as CardSchema })
  registerCard({ type: 'goal', component: GoalCard, meta: goalMeta as CardMeta, schema: goalSchema as CardSchema })
  registerCard({ type: 'bullet', component: BulletCard, meta: bulletMeta as CardMeta, schema: bulletSchema as CardSchema })
  registerCard({ type: 'favorites', component: FavoritesCard, meta: favoritesMeta as CardMeta, schema: favoritesSchema as CardSchema })
  registerCard({ type: 'recent', component: RecentCard, meta: recentMeta as CardMeta, schema: recentSchema as CardSchema })
}
