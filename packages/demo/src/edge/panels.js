/**
 * The demo's edge bar (#5506): what `features.edgeBar.panels(context)` gives.
 * A global panel, Activity, on every page but the genres'; a contextual one,
 * Comments, on a book's page only, with that book. The badges stay live while it is closed.
 */
import { reactive, ref } from 'vue'
import ActivityPanel from './ActivityPanel.vue'
import BookCommentsPanel from './BookCommentsPanel.vue'

/** What happened lately, and how much of it nobody looked at */
export const activity = reactive([
  { at: '09:12', text: 'Dune was loaned to june' },
  { at: '09:40', text: 'A new book: Foundation' },
  { at: '10:05', text: 'bob returned The Hobbit' },
])
export const unseenActivity = ref(activity.length)

/** Comments, by book id (kept for the session) */
export const comments = reactive({})
export const commentsOf = (bookId) => (comments[bookId] ??= [])

export function edgePanels(context) {
  // The genres' pages give no panel (#5518): the bar goes there, and an open
  // panel opens again on the next page that gives one
  if (context.route.path.startsWith('/genres')) return []
  const book = context.entity('books')
  return [
    { key: 'activity', label: 'Activity', icon: 'pi pi-bolt', tone: 'info', component: ActivityPanel, badge: unseenActivity },
    ...(book?.id
      ? [{ key: 'comments', label: 'Comments', icon: 'pi pi-comments', tone: 'watch', component: BookCommentsPanel, props: { bookId: String(book.id) }, badge: () => commentsOf(String(book.id)).length }]
      : []),
  ]
}
