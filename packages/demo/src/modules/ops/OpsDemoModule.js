/**
 * Ops widgets demo (#4109)
 *
 * The widgets an ops cockpit needs on top of entity CRUD, each on a page you
 * can play with: a live task log (#4110), an entity's history across actors (#4111),
 * messages in their own format and their diff (#4112), captured emails (#4113),
 * long backend tasks followed to the end (#4114), a live YAML configuration (#4303),
 * a card dashboard each user arranges (#4320).
 */
import { defineAsyncComponent } from 'vue'
import { Module, registerTaskKind, QdFavoritesCard, QdRecentCard } from '@quazardous/qdadm'
import { getTask, cancelTask, readLog, readPhases, createTask } from './fakeTasks'

export class OpsDemoModule extends Module {
  static moduleName = 'ops-demo'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // Registered here, not in the page: a run of these kinds resumes after a reload (#4114).
    const kind = {
      task: { get: getTask, intervalMs: 1000 },
      cancel: cancelTask,
      log: (id) => ({ poll: (from) => readLog(id, from), intervalMs: 500 }),
      // The log's lines start with an ISO time, dimmed in the dialog (#4386)
      logPatterns: { timestampPattern: '\\d{4}-\\d{2}-\\d{2}T[\\d:]+Z' },
      // The phases frieze above the log, read at the log's pace (#4655)
      phases: readPhases,
      phaseIcons: { restore: 'pi pi-database' },
    }
    // Phase labels: `phase.<name>` in the app's catalogue
    ctx.messages('en', {
      phase: {
        allocate: 'Allocate', clone: 'Clone', install: 'Install', restore: 'Restore', start: 'Start',
        stop: 'Stop', 'drop-db': 'Drop the database', release: 'Release', migrate: 'Migrate',
        reach: 'Reach', services: 'Services', disk: 'Disk', 'read-conf': 'Read', compare: 'Compare', secrets: 'Secrets',
        download: 'Download the dump', import: 'Import it',
      },
    })
    ctx.messages('fr', {
      phase: {
        allocate: 'Allocation', clone: 'Clonage', install: 'Installation', restore: 'Restauration', start: 'Démarrage',
        stop: 'Arrêt', 'drop-db': 'Suppression de la base', release: 'Libération', migrate: 'Migrations',
        reach: 'Connexion', services: 'Services', disk: 'Disque', 'read-conf': 'Lecture', compare: 'Comparaison', secrets: 'Secrets',
        download: 'Téléchargement du dump', import: 'Import',
      },
    })
    // A kind's own slot in the follow dialog (#4334)
    registerTaskKind('demo-create-box', { ...kind, slots: { 'after-log': defineAsyncComponent(() => import('./pages/BoxSummary.vue')) } })
    registerTaskKind('demo-destroy-box', { ...kind, cancel: undefined })
    // The two steps of "Verify" (#4934): a start from the meta, so the sequence goes on after a reload
    registerTaskKind('demo-check', { ...kind, start: (meta) => createTask('check', meta) })
    registerTaskKind('demo-conf-check', { ...kind, start: (meta) => createTask('conf-check', meta) })

    ctx.routes('ops-demo', [
      {
        path: 'log-stream',
        name: 'ops-log-stream',
        component: () => import('./pages/LogStreamPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'payloads',
        name: 'ops-payloads',
        component: () => import('./pages/PayloadPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'emails',
        name: 'ops-emails',
        component: () => import('./pages/EmailPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'tasks',
        name: 'ops-tasks',
        component: () => import('./pages/TaskPlayground.vue'),
        // The router refuses the page without it (#4332); its menu entry follows
        meta: { layout: 'page', permission: 'admin:ops:tasks' },
      },
      {
        path: 'pending',
        name: 'ops-pending',
        component: () => import('./pages/PendingPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'yaml-config',
        name: 'ops-yaml-config',
        component: () => import('./pages/YamlConfigPlayground.vue'),
        meta: { layout: 'page' },
      },
      // The rule builder (#5581)
      {
        path: 'routing-rules',
        name: 'ops-routing-rules',
        component: () => import('./pages/RoutingRulesPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'dashboard',
        name: 'ops-dashboard',
        component: () => import('./pages/DashboardPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'sessions-sim',
        name: 'ops-sessions-sim',
        component: () => import('./pages/SessionsPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'tabs',
        name: 'ops-tabs',
        component: () => import('./pages/TabsPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'timeline',
        name: 'ops-timeline',
        component: () => import('./pages/TimelinePlayground.vue'),
        meta: { layout: 'page' },
      },
    ])
    // The cards' gallery (#5339): every registered card, in each state, size and
    // theme, from its sheet's example. The reference for their look.
    ctx.routes('cards', [
      {
        path: '',
        name: 'cards-gallery',
        component: () => import('./pages/CardsGallery.vue'),
        meta: { layout: 'page' },
      },
    ])
    // The dashboard's cards (#4320): plain blocks, shown by a classic Zone or by
    // CardsDashboard alike. `card` only adds what arranging needs; the others
    // take their title from their `title` prop.
    ctx.zone('ops-dashboard')
    const DemoCard = defineAsyncComponent(() => import('./pages/DemoCard.vue'))
    const cards = [
      ['sales', { title: 'Sales', value: '€ 48 210', text: 'This month, +12 %', icon: 'pi pi-euro' }, { required: true, span: 2 }],
      ['orders', { title: 'Orders', value: '1 284', text: '37 waiting for shipping', icon: 'pi pi-shopping-cart' }, {}],
      ['stock', { title: 'Low stock', value: '9', text: 'SKUs under their minimum', icon: 'pi pi-box' }, {}],
      ['alerts', { title: 'Alerts', value: '2', text: 'A feed failed, a task is stuck', icon: 'pi pi-bell' }, { pinned: true }],
      ['news', { title: 'News', text: 'Release notes and announcements', icon: 'pi pi-megaphone' }, { fixed: true }],
      ['visitors', { title: 'Visitors', value: '6 932', text: 'Today, all stores', icon: 'pi pi-users' }, {}],
      ['tasks', { title: 'Tasks', value: '4', text: 'Running in the background', icon: 'pi pi-cog' }, {}],
    ]
    cards.forEach(([id, props, card], i) => {
      ctx.block('ops-dashboard', { id, component: DemoCard, props, weight: (i + 1) * 10, ...(Object.keys(card).length ? { card } : {}) })
    })
    // The person's favourites and the records they opened lately (#5349), live
    ctx.block('ops-dashboard', { id: 'favorites', component: QdFavoritesCard, props: { maxItems: 3, moreTo: { name: 'favorite' } }, weight: 5, card: { title: 'Favourites', pinned: true } })
    ctx.block('ops-dashboard', { id: 'recent', component: QdRecentCard, weight: 6, card: { title: 'Recent' } })
    // Ready-made cards fed from the books (#5355)
    const BooksCard = defineAsyncComponent(() => import('./pages/BooksCard.vue'))
    ctx.block('ops-dashboard', { id: 'books-ranking', component: BooksCard, props: { kind: 'ranking' }, weight: 80, card: { title: 'Most loaned' } })
    ctx.block('ops-dashboard', { id: 'books-split', component: BooksCard, props: { kind: 'split' }, weight: 81, card: { title: 'Catalogue by genre' } })
    ctx.block('ops-dashboard', { id: 'loans-agenda', component: BooksCard, props: { kind: 'agenda' }, weight: 82, card: { title: 'Loans coming back' } })
    // A card each person adds from the catalogue, once per genre (#5348): its
    // parameters are a schema, and arrive as its props
    ctx.block('ops-dashboard', {
      id: 'saved-search',
      component: defineAsyncComponent(() => import('./pages/SavedSearchCard.vue')),
      weight: 100,
      card: {
        title: 'Saved search',
        description: 'The books of one genre, oldest first, to review one after the other',
        repeatable: true,
        // One or two columns, one or two rows high (#5503): taller, it lists twice the lines
        sizes: ['1x1', '2x1', '1x2', '2x2'],
        params: {
          type: 'object',
          required: ['genre'],
          properties: {
            genre: {
              type: 'string',
              title: 'Genre',
              enum: ['fantasy', 'fiction', 'mystery', 'non-fiction', 'sci-fi'],
              enumLabels: { fantasy: 'Fantasy', fiction: 'Fiction', mystery: 'Mystery', 'non-fiction': 'Non-fiction', 'sci-fi': 'Sci-fi' },
            },
            maxItems: { type: 'integer', title: 'Lines', minimum: 1, maximum: 5, description: 'How many books the card lists (default 3)' },
          },
        },
      },
    })
    ctx.navItem({ section: 'Features', route: 'ops-dashboard', icon: 'pi pi-th-large', label: 'Dashboard' })
    ctx.navItem({ section: 'Features', route: 'cards-gallery', icon: 'pi pi-clone', label: 'Cards' })
    ctx.navItem({ section: 'Features', route: 'ops-sessions-sim', icon: 'pi pi-users', label: 'Sessions demo' })
    ctx.navItem({ section: 'Features', route: 'ops-log-stream', icon: 'pi pi-align-left', label: 'Log stream' })
    ctx.navItem({ section: 'Features', route: 'ops-timeline', icon: 'pi pi-history', label: 'Timeline' })
    ctx.navItem({ section: 'Features', route: 'ops-tabs', icon: 'pi pi-folder', label: 'Tabs' })
    ctx.navItem({ section: 'Features', route: 'ops-payloads', icon: 'pi pi-code', label: 'Payloads' })
    ctx.navItem({ section: 'Features', route: 'ops-emails', icon: 'pi pi-envelope', label: 'Emails' })
    // Gated by its route's permission, not an entity (#4318, #4332): hidden from
    // whoever may not open the page, and lit on its own page
    ctx.navItem({ section: 'Features', route: 'ops-tasks', icon: 'pi pi-cog', label: 'Tasks' })
    ctx.navItem({ section: 'Features', route: 'ops-pending', icon: 'pi pi-hourglass', label: 'Pending reads' })
    ctx.navItem({ section: 'Features', route: 'ops-yaml-config', icon: 'pi pi-file-edit', label: 'YAML config' })
    ctx.navItem({ section: 'Features', route: 'ops-routing-rules', icon: 'pi pi-sitemap', label: 'Routing rules' })
  }
}

export default OpsDemoModule
