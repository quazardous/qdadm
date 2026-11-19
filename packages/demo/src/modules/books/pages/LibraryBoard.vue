<script setup>
/**
 * LibraryBoard - the library's domain board (#5352): the level between the
 * dashboard and the books list. Each block reads its own data through the
 * entities' managers (one of them slowly, on purpose: it waits alone).
 */
import { useOrchestrator, usePageTitle, QdDomainBoard } from '@quazardous/qdadm'

usePageTitle('Library')

const { getManager } = useOrchestrator()
const books = () => getManager('books').list({ page_size: 1000 }).then((r) => r.items)
const loans = () => getManager('loans').list({ page_size: 1000 }).then((r) => r.items)
const later = (ms, fn) => new Promise((resolve) => setTimeout(() => resolve(fn()), ms))

const DAY = 86400000
const open = (loan) => !loan.returned_at
const overdue = (loan) => open(loan) && Date.now() - new Date(loan.borrowed_at).getTime() > 14 * DAY

const blocks = [
  { type: 'kpi', load: async () => ({ label: 'Books', value: (await books()).length, note: 'in the catalogue', to: { name: 'book' } }) },
  { type: 'kpi', load: async () => ({ label: 'On loan', value: (await loans()).filter(open).length, note: 'not returned yet', to: { name: 'loan' } }) },
  {
    type: 'kpi',
    load: async () => {
      const n = (await loans()).filter(overdue).length
      return { label: 'Overdue', value: n, status: n ? 'critical' : 'good', note: n ? 'borrowed more than 2 weeks ago' : 'nothing late' }
    },
  },
  { type: 'kpi', load: async () => ({ label: 'Genres', value: (await getManager('genres').list({ page_size: 100 })).items.length, to: { name: 'genre' } }) },
  {
    type: 'breakdown',
    title: 'The catalogue',
    load: async () => {
      const all = await books()
      const count = (key) => Object.entries(all.reduce((acc, b) => ({ ...acc, [key(b)]: (acc[key(b)] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
      return {
        groups: [
          { title: 'By genre', rows: count((b) => b.genre).map(([label, value]) => ({ label, value, to: { name: 'book', query: { 'books.genre': label } } })) },
          { title: 'By decade', rows: count((b) => `${Math.floor(b.year / 10) * 10}s`).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value })) },
        ],
      }
    },
  },
  {
    type: 'top',
    title: 'Most loaned',
    more: { label: 'All loans', to: { name: 'loan' } },
    load: async () => {
      const [all, lent] = await Promise.all([books(), loans()])
      const times = (b) => lent.filter((l) => l.book_id === b.bookId).length
      return {
        columns: [
          { key: 'title', label: 'Title' },
          { key: 'genre', label: 'Genre', type: 'tags' },
          { key: 'loans', label: 'Loans', type: 'number' },
        ],
        rows: all
          .map((b) => ({ b, n: times(b) }))
          .sort((x, y) => y.n - x.n || x.b.title.localeCompare(y.b.title))
          .slice(0, 5)
          .map(({ b, n }) => ({ to: { name: 'book-show', params: { bookId: b.bookId } }, values: { title: b.title, genre: [{ label: b.genre }], loans: n } })),
      }
    },
  },
  {
    type: 'timeline',
    title: 'Loans per day (simulated, read in 1.5 s)',
    // A slow source on purpose: this block waits alone, the others are drawn
    load: () =>
      later(1500, () => ({
        label: 'loans',
        previous: 54,
        higherIs: 'neutral',
        points: Array.from({ length: 14 }, (_, i) => ({ at: new Date(Date.now() - (13 - i) * DAY).toISOString(), value: [3, 5, 4, 6, 2, 1, 4, 7, 5, 6, 3, 2, 5, 8][i] })),
      })),
  },
]
</script>

<template>
  <QdDomainBoard :source="{ label: 'the library', freshness: new Date(), to: { name: 'book' } }" :blocks="blocks" />
</template>
