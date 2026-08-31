/**
 * qdadm live entities — reference implementation (#1888).
 *
 * Demonstrates the whole path: a backend mutates data on its own, pushes a
 * one-line fact over SSE, and a list page that is ALREADY OPEN updates itself.
 * Nothing in `RunList.vue` subscribes to anything — that is the point. Before
 * #1888 every screen had to wire its own refresh call, which put logic in the
 * presentation layer that the architecture forbids.
 *
 * Read `server.mjs` for the other side of the contract.
 * Read docs/adr/0009-live-entities.md for why it is shaped this way.
 */
import axios from 'axios'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import { Kernel, Module, EntityManager, ApiStorage } from '@quazardous/qdadm'
import { AppLayout } from '@quazardous/qdadm/components'
import '@quazardous/qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'

// Vite proxies /api, /events and /ticket to server.mjs — see vite.config.js.
const api = axios.create({ baseURL: '/' })

class RunsModule extends Module {
  static name = 'runs'

  async connect(ctx) {
    ctx.entity('runs', new EntityManager({
      name: 'runs',
      label: 'Run',
      labelPlural: 'Runs',
      labelField: 'name',
      fields: {
        name: { type: 'text', label: 'Name' },
        status: { type: 'text', label: 'Status' },
        progress: { type: 'number', label: 'Progress' },
      },
      storage: new ApiStorage({ endpoint: '/api/runs', client: api }),

      // What this entity does when it learns it changed elsewhere.
      //
      // Both values below are the DEFAULTS — spelled out here because this is
      // a reference implementation, not because you need to write them. An
      // entity that declares no `live` block behaves exactly like this.
      live: {
        // 'mounted' — a screen currently showing runs reloads itself.
        // Set false for a heavy list you would rather leave alone until the
        // user asks: the stale cache is still dropped either way.
        refresh: 'mounted',

        // A backend replaying fifty rows must cost one reload, not fifty.
        // Widen this for a chatty stream; 0 reloads on every single frame and
        // is almost never what you want.
        coalesceMs: 300,
      },
    }))

    ctx.crud('runs', {
      list: () => import('./RunList.vue'),
    }, { nav: { section: 'Main', icon: 'pi pi-play' } })
  }
}

const kernel = new Kernel({
  root: App,
  moduleDefs: [RunsModule],
  pages: { layout: AppLayout },
  homeRoute: 'run',
  primevue: { plugin: PrimeVue, theme: Aura },
  apiClient: api,
  app: { name: 'Live entities' },

  sse: {
    url: '/events',

    // THE declaration. The app states what it knows about the backend serving
    // it: "runs is written behind my back". The backend knows nothing of this
    // config — it only emits, and an app that declares nothing sees no change
    // in behaviour at all.
    //
    // Anything not listed is ignored, because a stream carries more than
    // entity mutations (progress, notifications, telemetry). `true` or '*'
    // accepts every registered entity.
    entities: ['runs'],

    // EventSource cannot send headers, so this ends up in the query string —
    // and query strings outlive the session in access logs and history. So we
    // do NOT send the durable API token: we fetch a 30-second single-use
    // ticket per connect. `getToken` may return a promise precisely for this.
    //
    // Omit it entirely and qdadm falls back to the session auth token, which
    // is fine for a cookie-authenticated or internal deployment — just know
    // what you are writing to the logs.
    getToken: async () => {
      const { data } = await api.get('/ticket')
      return data.ticket
    },

    // This demo has no login screen, so connect immediately instead of waiting
    // for `auth:login`. A real admin leaves both of these alone: the defaults
    // connect after login and disconnect on logout.
    autoConnect: true,
    connectOnSignal: null,

    debug: true, // logs routed and ignored frames — open the console
  },

  debug: true,
})

kernel.createApp().mount('#app')
