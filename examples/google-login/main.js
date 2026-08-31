/**
 * qdadm Google sign-in — reference implementation (#1775).
 *
 * The whole front-end integration is the `authAdapter` below plus one public
 * route. Read `server.mjs` for the other half, and `docs/auth-google.md` for
 * the contract between them.
 */
import axios from 'axios'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import { Kernel, Module, EntityManager, ApiStorage, GoogleOAuthAdapter } from '@quazardous/qdadm'
import { AppLayout } from '@quazardous/qdadm/components'
import '@quazardous/qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'

const api = axios.create({ baseURL: '/' })

// The client id is NOT a secret and ships in the bundle. The client SECRET
// never leaves server.mjs — that asymmetry is the whole security model.
const authAdapter = new GoogleOAuthAdapter({
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  exchangeUrl: '/auth/google/exchange',

  // Must match a redirect URI registered in the Google console EXACTLY —
  // scheme, host, port and path. A trailing slash is a mismatch. This is the
  // single most common setup failure, which is why the port is pinned in
  // vite.config.js rather than left to whatever is free.
  redirectUri: `${window.location.origin}/auth/google/callback`,
})

class NotesModule extends Module {
  static name = 'notes'

  async connect(ctx) {
    ctx.entity('notes', new EntityManager({
      name: 'notes',
      label: 'Note',
      labelPlural: 'Notes',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title' },
        body: { type: 'text', label: 'Body' },
      },
      storage: new ApiStorage({ endpoint: '/api/notes', client: api }),
    }))

    ctx.crud('notes', { list: () => import('./NoteList.vue') },
      { nav: { section: 'Main', icon: 'pi pi-file' } })

    // THE ROUTE THAT MUST BE PUBLIC.
    //
    // The router sends unauthenticated visitors to /login. On the way back
    // from Google the user is not authenticated YET — that is what this route
    // is for. Without `public: true` the callback bounces to login and the
    // sign-in silently never completes, with nothing pointing at the cause.
    ctx.routes('/auth/google', [{
      path: 'callback',
      name: 'google-callback',
      // Through the barrel, not a deep path: anything outside the exports
      // map is internal (docs/API_STABILITY.md).
      component: () => import('@quazardous/qdadm/components').then((m) => m.OAuthCallbackPage),
      meta: { public: true },
    }])
  }
}

const kernel = new Kernel({
  root: App,
  moduleDefs: [NotesModule],
  pages: { layout: AppLayout, login: () => import('./Login.vue') },
  homeRoute: 'note',
  primevue: { plugin: PrimeVue, theme: Aura },
  apiClient: api,
  authAdapter,
  entityAuthAdapter: () => authAdapter.getUser(),
  app: { name: 'Google sign-in' },
  debug: true,
})

// Our session token, not Google's, on every API call.
api.interceptors.request.use((config) => {
  const token = authAdapter.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

kernel.createApp().mount('#app')
