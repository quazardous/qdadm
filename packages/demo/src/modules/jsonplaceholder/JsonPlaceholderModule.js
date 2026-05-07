/**
 * JSONPlaceholder Module - Module-Centric Pattern
 *
 * Groups all JSONPlaceholder API entities:
 * - jp_users: Users from JSONPlaceholder
 * - posts: Posts from JSONPlaceholder
 * - todos: Todos from JSONPlaceholder
 *
 * All are read-only external API entities.
 */

import { Module, ApiStorage } from '@quazardous/qdadm'
import axios from 'axios'

// ============================================================================
// STORAGE
// ============================================================================

const jpClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com'
})

// JSONPlaceholder ignores ?page / ?page_size and returns the full collection
// every time, so we slice client-side. Same approach as RestCountriesStorage.
class JsonPlaceholderStorage extends ApiStorage {
  async list({ page = 1, page_size = 20, sort_by, sort_order, filters = {} } = {}) {
    const response = await this.client.get(this.endpoint)
    let items = response.data
    for (const [k, v] of Object.entries(filters)) {
      if (v == null || v === '') continue
      items = items.filter((it) => String(it[k]) === String(v))
    }
    if (sort_by) {
      const dir = sort_order === 'desc' ? -1 : 1
      items = [...items].sort((a, b) => {
        const av = a[sort_by], bv = b[sort_by]
        if (av === bv) return 0
        return av > bv ? dir : -dir
      })
    }
    const total = items.length
    const start = (page - 1) * page_size
    return { items: items.slice(start, start + page_size), total }
  }
}

const jpUsersStorage = new JsonPlaceholderStorage({ endpoint: '/users', client: jpClient })
const postsStorage = new JsonPlaceholderStorage({ endpoint: '/posts', client: jpClient })

// ────────────────────────────────────────────────────────────────────────────
// DEMO HACK — todos `completed` toggle persists in localStorage
// ────────────────────────────────────────────────────────────────────────────
// JSONPlaceholder is a public mock API that accepts PATCH (200 OK) but never
// persists anything server-side. By default that means a user clicks the
// checkbox on /todos, sees the toggle apply locally, but as soon as anything
// triggers a re-fetch (pagination, filter change, page reload, browser back/
// forward) the original `completed` value comes back from the API and the
// toggle disappears. That makes the demo look broken even though it isn't.
//
// To keep the demo self-explanatory without standing up a real backend, we
// overlay user patches on top of the API response. Each patch from `patch()`
// is stored under `qdadm-demo:todos:patches` in localStorage, keyed by todo
// id, and re-applied to every `list()` / `get()` result before filtering/
// sorting. Only `todos` use this — `posts` and `jp_users` keep raw
// JSONPlaceholder behaviour because they're not meant to be edited in the
// demo.
//
// Reset: open DevTools → Application → Local Storage and delete the key.
// If/when this demo swaps for a real persistent backend, drop the wrapper.
// ────────────────────────────────────────────────────────────────────────────
const TODOS_PATCH_KEY = 'qdadm-demo:todos:patches'

class TodosLocalOverlayStorage extends JsonPlaceholderStorage {
  _readPatches() {
    try {
      return JSON.parse(localStorage.getItem(TODOS_PATCH_KEY) || '{}') || {}
    } catch {
      return {}
    }
  }

  _writePatches(patches) {
    try {
      localStorage.setItem(TODOS_PATCH_KEY, JSON.stringify(patches))
    } catch {
      // quota exceeded or storage disabled — silently ignore (demo)
    }
  }

  _applyPatches(item, patches) {
    const patch = item && patches[item.id]
    return patch ? { ...item, ...patch } : item
  }

  async list(params = {}) {
    const patches = this._readPatches()
    // Fetch + filter/sort/slice via parent. Patches must be applied BEFORE
    // filtering & sorting so a user-toggled `completed` lands in the right
    // bucket — so we shadow the parent and inline the same pipeline.
    const { page = 1, page_size = 20, sort_by, sort_order, filters = {} } = params
    const response = await this.client.get(this.endpoint)
    let items = response.data.map((it) => this._applyPatches(it, patches))
    for (const [k, v] of Object.entries(filters)) {
      if (v == null || v === '') continue
      items = items.filter((it) => String(it[k]) === String(v))
    }
    if (sort_by) {
      const dir = sort_order === 'desc' ? -1 : 1
      items = [...items].sort((a, b) => {
        const av = a[sort_by], bv = b[sort_by]
        if (av === bv) return 0
        return av > bv ? dir : -dir
      })
    }
    const total = items.length
    const start = (page - 1) * page_size
    return { items: items.slice(start, start + page_size), total }
  }

  async get(id, context = null) {
    const item = await super.get(id, context)
    return this._applyPatches(item, this._readPatches())
  }

  async patch(id, data) {
    const patches = this._readPatches()
    patches[id] = { ...(patches[id] || {}), ...data }
    this._writePatches(patches)
    // Mirror server "200 OK" by returning the merged item — and still hit
    // the API so the network panel shows real traffic.
    const item = await super.patch(id, data).catch(() => null)
    return { ...(item || { id }), ...patches[id] }
  }
}

const todosStorage = new TodosLocalOverlayStorage({ endpoint: '/todos', client: jpClient })

// ============================================================================
// MODULE
// ============================================================================

export class JsonPlaceholderModule extends Module {
  static moduleName = 'jsonplaceholder'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // I18N
    // ════════════════════════════════════════════════════════════════════════
    ctx.messages('en', {
      entities: {
        jp_users: {
          label: 'User', labelPlural: 'Users',
          fields: { name: 'Full name', username: 'Username', email: 'Email', phone: 'Phone', website: 'Website' },
        },
        posts: {
          label: 'Post', labelPlural: 'Posts',
          fields: { title: 'Title', body: 'Body', userId: 'Author' },
        },
        todos: {
          label: 'Todo', labelPlural: 'Todos',
          fields: { title: 'Title', completed: 'Completed', userId: 'Assigned to' },
        },
      },
      nav: {
        sections: { JSONPlaceholder: 'JSONPlaceholder' },
        routes: { jp_user: 'JP Users', post: 'Posts', todo: 'Todos' },
      },
    })
    ctx.messages('fr', {
      entities: {
        jp_users: {
          label: 'Utilisateur', labelPlural: 'Utilisateurs',
          fields: { name: 'Nom complet', username: "Nom d'utilisateur", email: 'E-mail', phone: 'Téléphone', website: 'Site web' },
        },
        posts: {
          label: 'Article', labelPlural: 'Articles',
          fields: { title: 'Titre', body: 'Contenu', userId: 'Auteur' },
        },
        todos: {
          label: 'Tâche', labelPlural: 'Tâches',
          fields: { title: 'Titre', completed: 'Terminée', userId: 'Assignée à' },
        },
      },
      nav: {
        sections: { JSONPlaceholder: 'JSONPlaceholder' },
        routes: { jp_user: 'Utilisateurs JP', post: 'Articles', todo: 'Tâches' },
      },
    })

    // ════════════════════════════════════════════════════════════════════════
    // ENTITIES
    // ════════════════════════════════════════════════════════════════════════

    ctx.entity('jp_users', {
      name: 'jp_users',
      labelField: 'name',
      readOnly: true,
      localFilterThreshold: 0,
      fields: {
        id: { type: 'number', label: 'ID', readOnly: true },
        name: { type: 'text', label: 'Full Name', required: true },
        username: { type: 'text', label: 'Username', required: true },
        email: { type: 'email', label: 'Email', required: true },
        phone: { type: 'text', label: 'Phone' },
        website: { type: 'url', label: 'Website' }
      },
      storage: jpUsersStorage
    })

    ctx.entity('posts', {
      name: 'posts',
      labelField: 'title',
      readOnly: true,
      localFilterThreshold: 0,
      fields: {
        id: { type: 'number', label: 'ID', readOnly: true },
        title: { type: 'text', label: 'Title', required: true },
        body: { type: 'textarea', label: 'Body', required: true },
        userId: { type: 'number', label: 'Author', required: true }
      },
      storage: postsStorage
    })

    ctx.entity('todos', {
      name: 'todos',
      labelField: 'title',
      readOnly: true,
      localFilterThreshold: 0,
      fields: {
        id: { type: 'number', label: 'ID', readOnly: true },
        title: { type: 'text', label: 'Title', required: true },
        completed: { type: 'boolean', label: 'Completed' },
        userId: { type: 'number', label: 'Assigned To', required: true }
      },
      storage: todosStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud for list+nav, ctx.routes for detail pages)
    // ════════════════════════════════════════════════════════════════════════

    // JP Users - list + detail
    ctx.crud('jp_users', {
      list: () => import('../../pages/JpUsersPage.vue')
    }, {
      routePrefix: 'jp_user',
      nav: { section: 'JSONPlaceholder', icon: 'pi pi-users', label: 'JP Users' }
    })
    ctx.routes('jp-users/:id', [
      {
        path: '',
        name: 'jp_user-show',
        component: () => import('../../pages/JpUserShowPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'jp_users' })

    // Posts - list + detail
    ctx.crud('posts', {
      list: () => import('../posts/pages/PostsPage.vue')
    }, {
      nav: { section: 'JSONPlaceholder', icon: 'pi pi-file', label: 'Posts' }
    })

    // Child: posts for a specific user
    ctx.crud('posts', {
      list: () => import('./pages/UserPostsPage.vue')
    }, {
      parentRoute: 'jp_user',
      foreignKey: 'userId',
      label: 'Posts'
    })
    ctx.routes('posts/:id', [
      {
        path: '',
        name: 'post-show',
        component: () => import('../posts/pages/PostShowPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'posts' })

    // Todos - list only
    ctx.crud('todos', {
      list: () => import('../todos/pages/TodosPage.vue')
    }, {
      nav: { section: 'JSONPlaceholder', icon: 'pi pi-check-square', label: 'Todos' }
    })

    // Child: todos for a specific user
    ctx.crud('todos', {
      list: () => import('./pages/UserTodosPage.vue')
    }, {
      parentRoute: 'jp_user',
      foreignKey: 'userId',
      label: 'Todos'
    })
  }
}

export default JsonPlaceholderModule
