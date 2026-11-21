<script setup lang="ts">
/**
 * QdCardView - a registered card type in its envelope (#5339)
 *
 *   <QdCardView type="metric" :envelope="{ title: 'Retours ouverts', status: 'watch', source: 'sav' }"
 *               :data="{ value: 23, delta: { value: 4, period: 'sem.' }, series }" :options="{ higherIs: 'worse' }" />
 *
 * The data and the options are checked against the type's schema and sheet
 * first: what does not fit draws the `invalid` state with its reasons, and the
 * board around it keeps working. An unknown type is `invalid` too.
 */
import { computed } from 'vue'
import QdCard from './QdCard.vue'
import { getCard, checkCardInput, resolveCardOptions } from './registry'
import type { CardEnvelope } from './types'
import type { SchemaProblem } from './validate'

const props = withDefaults(
  defineProps<{
    type: string
    envelope: CardEnvelope
    data?: unknown
    options?: Record<string, unknown>
    /** Listeners for the body's own events (a favourite removed…) */
    on?: Record<string, (...args: never[]) => unknown>
  }>(),
  { data: undefined, options: () => ({}), on: () => ({}) }
)

const definition = computed(() => getCard(props.type))
const state = computed(() => props.envelope.state ?? 'ready')

const problems = computed<SchemaProblem[]>(() => {
  if (!definition.value) return [{ path: 'type', message: `no card of type '${props.type}' is registered` }]
  // Only data that is meant to be drawn is checked
  if (state.value !== 'ready') return []
  return checkCardInput(definition.value, props.data, props.options)
})

const shownState = computed(() => (problems.value.length ? 'invalid' : state.value))
const options = computed(() => (definition.value ? resolveCardOptions(definition.value.meta, props.options) : {}))
// The envelope's icon, else the type's; `null` or '' says none
const icon = computed(() => (props.envelope.icon !== undefined ? props.envelope.icon || null : definition.value?.meta.icon ?? null))
const size = computed(() => props.envelope.size ?? definition.value?.meta.sizes[0] ?? 's')
</script>

<template>
  <QdCard
    v-bind="envelope"
    :size="size"
    :icon="icon"
    :state="shownState"
    :problems="problems"
    :data-card-type="type"
  >
    <component :is="definition!.component" v-if="definition" :data="data" :options="options" :size="size" v-on="on" />
  </QdCard>
</template>
