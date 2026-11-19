<script setup>
/**
 * Cards fed from the books (#5355): the most loaned (ranking), the catalogue
 * by genre (split), the loans coming back (agenda). Each reads the entities
 * through their managers and says when it waits.
 */
import { computed } from 'vue'
import { useOrchestrator, useAsyncRead, QdCardView } from '@quazardous/qdadm'

const props = defineProps({ kind: { type: String, required: true } })

const { getManager } = useOrchestrator()
const read = useAsyncRead(async () => {
  const [books, loans] = await Promise.all([getManager('books').list({ page_size: 1000 }), getManager('loans').list({ page_size: 1000 })])
  return { books: books.items, loans: loans.items }
})

const TYPES = { ranking: 'ranking', split: 'split', agenda: 'agenda' }
const TITLES = { ranking: 'Most loaned', split: 'Catalogue by genre', agenda: 'Loans coming back' }

const data = computed(() => {
  const r = read.data.value
  if (!r) return undefined
  if (props.kind === 'ranking') {
    return {
      items: r.books.map((b) => ({ label: b.title, value: r.loans.filter((l) => l.book_id === b.bookId).length, to: { name: 'book-show', params: { bookId: b.bookId } } })),
    }
  }
  if (props.kind === 'split') {
    const by = r.books.reduce((acc, b) => ({ ...acc, [b.genre]: (acc[b.genre] ?? 0) + 1 }), {})
    return { parts: Object.entries(by).map(([label, value]) => ({ label, value, to: { name: 'book', query: { 'books.genre': label } } })) }
  }
  // Due back two weeks after they were borrowed; the open ones only
  const title = (id) => r.books.find((b) => b.bookId === id)?.title ?? id
  return {
    items: r.loans
      .filter((l) => !l.returned_at)
      .map((l) => ({ at: new Date(new Date(l.borrowed_at).getTime() + 14 * 86400000).toISOString(), label: `${title(l.book_id)} due back`, to: { name: 'loan' }, allDay: true })),
  }
})

const envelope = computed(() => ({
  title: TITLES[props.kind],
  source: 'library',
  status: 'info',
  to: { name: 'book-board' },
  state: read.pending.value ? 'loading' : read.error.value ? 'unreachable' : 'ready',
  error: read.error.value ?? undefined,
}))
</script>

<template>
  <QdCardView :type="TYPES[kind]" :envelope="envelope" :data="data" :options="kind === 'ranking' ? { maxItems: 3, bars: true } : {}" />
</template>
