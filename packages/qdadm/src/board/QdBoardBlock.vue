<script setup lang="ts">
/**
 * QdBoardBlock (#5352): one block of a domain's board. It reads its own data
 * when given `load` (useAsyncRead), checks it against its type's schema, and
 * draws its own states: loading, unreachable with a retry, empty, invalid.
 * One slow source never holds the board.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import QdButton from '../components/base/QdButton.vue'
import { useI18n } from '../i18n/useI18n'
import { useAsyncRead } from '../composables/useAsyncRead'
import { validateCardData } from '../cards/validate'
import { getBoardBlock } from './registry'
import type { BoardBlock } from './types'

const props = defineProps<{ block: BoardBlock }>()
const { tOr } = useI18n()

const def = computed(() => getBoardBlock(props.block.type))
const read = props.block.load ? useAsyncRead(() => props.block.load!()) : null
const data = computed(() => (read ? read.data.value : props.block.data))

const state = computed<'loading' | 'unreachable' | 'invalid' | 'empty' | 'ready'>(() => {
  if (!def.value) return 'invalid'
  if (read && !read.ready.value) return read.error.value ? 'unreachable' : 'loading'
  if (problems.value.length) return 'invalid'
  return def.value.isEmpty?.(data.value) ? 'empty' : 'ready'
})
const problems = computed(() => {
  if (!def.value) return [{ path: 'type', message: `no board block of type '${props.block.type}' is registered` }]
  if (read && !read.ready.value) return []
  return validateCardData(data.value, def.value.schema, 'data')
})
</script>

<template>
  <section
    class="qd-board-block"
    :class="`qd-board-block--${block.type}`"
    :data-board-block="block.type"
    :data-board-state="state"
    :aria-busy="state === 'loading' || undefined"
  >
    <h2 v-if="block.title" class="qd-board-title">{{ block.title }}</h2>

    <p v-if="state === 'loading'" class="qd-board-state">
      <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> {{ tOr('core.cards.loading', 'Loading…') }}
    </p>
    <div v-else-if="state === 'unreachable'" class="qd-board-state qd-board-state--error" role="alert">
      <span><i class="pi pi-exclamation-triangle" aria-hidden="true"></i> {{ tOr('core.cards.unreachable', 'Source unreachable') }}: {{ read?.error.value }}</span>
      <QdButton type="button" size="small" text icon="pi pi-refresh" :label="tOr('core.board.retry', 'Try again')" @click="read?.load()" />
    </div>
    <div v-else-if="state === 'invalid'" class="qd-board-state qd-board-state--error">
      <span>{{ tOr('core.cards.invalid', 'Invalid data') }}</span>
      <ul class="qd-board-problems">
        <li v-for="(p, i) in problems.slice(0, 3)" :key="i"><code>{{ p.path }}</code> {{ p.message }}</li>
      </ul>
    </div>
    <p v-else-if="state === 'empty'" class="qd-board-state">{{ block.emptyText ?? tOr('core.cards.empty', 'Nothing to report') }}</p>
    <component :is="def!.component" v-else :data="data" />

    <RouterLink v-if="block.more && state === 'ready'" :to="block.more.to" class="qd-board-more">
      {{ block.more.label }} <i class="pi pi-arrow-right" aria-hidden="true"></i>
    </RouterLink>
  </section>
</template>
