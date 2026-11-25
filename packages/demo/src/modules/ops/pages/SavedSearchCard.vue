<script setup>
/**
 * A saved search (#5348): the books of one genre, as a queue card whose
 * button walks them one after the other (#5343). It is a repeatable block of
 * the ops-dashboard zone: each person adds it from the catalogue, once per
 * genre, and its parameters (genre, how many lines) arrive as its props.
 * Two rows high on the dashboard (#5503), it lists twice the lines.
 */
import { computed } from 'vue'
import { useOrchestrator, useAsyncRead, useCardSlotSize, QdCardView } from '@quazardous/qdadm'

const props = defineProps({
  genre: { type: String, required: true },
  maxItems: { type: Number, default: 3 },
})

const slot = useCardSlotSize()
const lines = computed(() => props.maxItems * (slot.value?.h ?? 1))

const { getManager } = useOrchestrator()
const books = getManager('books')
const read = useAsyncRead(() => books.list({ page_size: 1000 }), { key: () => props.genre })

const matches = computed(() => (read.data.value?.items ?? []).filter((b) => b.genre === props.genre).sort((a, b) => a.year - b.year))
const genreLabel = computed(() => props.genre)
const envelope = computed(() => ({
  title: `Books: ${genreLabel.value}`,
  status: 'info',
  source: 'books',
  to: { name: 'book' },
  state: read.pending.value ? 'loading' : read.error.value ? 'unreachable' : matches.value.length ? 'ready' : 'empty',
  ...(matches.value.length
    ? {
        action: {
          verb: 'Review the 1st',
          mode: 'next',
          count: matches.value.length,
          run: { entity: 'books', items: matches.value.map((b) => ({ id: b.bookId, label: b.title })), label: 'to review', order: 'year', filter: genreLabel.value },
        },
      }
    : {}),
}))
const data = computed(() => ({
  total: matches.value.length,
  note: 'books',
  items: matches.value.map((b) => ({ label: `${b.title} · ${b.year}`, to: { name: 'book-edit', params: { bookId: b.bookId } } })),
}))
</script>

<template>
  <QdCardView type="queue" :envelope="envelope" :data="data" :options="{ maxItems: lines }" />
</template>
