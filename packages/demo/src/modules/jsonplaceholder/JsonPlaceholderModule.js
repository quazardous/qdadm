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

// Fetches the whole collection and slices client-side. Kept for `todos`
// ONLY, and for a reason that is not laziness: the local patch overlay below
// applies user edits BEFORE filtering, so a todo whose `completed` the user
// toggled has to be re-bucketed on the client. Ask the server to filter and
// it filters on its own unpatched copy, and the `completed` filter starts
// lying. Server-side pagination and a client-side overlay cannot both be
// right; the overlay wins here because it is what makes the demo honest
// about an API that accepts writes and persists none.
class JsonPlaceholderStorage extends ApiStorage {
  /**
   * Adjust the rows before ANYTHING filters, searches or sorts them.
   *
   * The extension point that stops a subclass having to reimplement the
   * pipeline to change one step (#2147). The todos overlay below needs its
   * patches applied first — it used to get that by copying this whole method,
   * which is why `search` support reached the copy and not the original, and
   * the todos search box did nothing.
   */
  _transformItems(items) {
    return items
  }

  async list({ page = 1, page_size = 20, sort_by, sort_order, filters = {}, search } = {}) {
    const response = await this.client.get(this.endpoint)
    let items = this._transformItems(response.data)
    // The search runs HERE rather than on the server, for the same reason
    // the filters do (#2147): the overlay below patches rows the user edited,
    // and asking the server to search would search its own unpatched copy.
    if (search && String(search).trim()) {
      const needle = String(search).toLowerCase().trim()
      items = items.filter((it) =>
        Object.values(it).some(
          (v) => typeof v === 'string' && v.toLowerCase().includes(needle)
        )
      )
    }
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

// REAL server-side pagination against JSONPlaceholder (#2113), and not a
// line of code to do it.
//
// This used to fetch the whole collection and slice it client-side, under a
// comment saying JSONPlaceholder "ignores ?page / ?page_size". True of THOSE
// names, wrong as a conclusion: json-server paginates with _page/_limit,
// sorts with _sort/_order and returns the count in X-Total-Count, which it
// exposes via CORS. Nothing was missing but the translation — and qdadm now
// carries pagination in the same `paramMapping` that already renamed filters,
// so the translation is declared instead of written.
//
// `posts` is the one that matters: 100 rows at 10 per page is 10 real pages,
// so the demo finally exercises the HTTP pagination path end to end instead
// of merely hosting it.
const JSON_SERVER_DIALECT = {
  paramMapping: {
    page: '_page',
    page_size: '_limit',
    sort_by: '_sort',
    sort_order: '_order',
    // json-server's full-text search (#2147). Without this line qdadm sends
    // `search=`, json-server has never heard of it, and the rows come back
    // unfiltered — which is exactly what the demo did.
    search: 'q',
  },
  responseTotalHeader: 'X-Total-Count',
}

const jpUsersStorage = new ApiStorage({ endpoint: '/users', client: jpClient, ...JSON_SERVER_DIALECT })
const postsStorage = new ApiStorage({ endpoint: '/posts', client: jpClient, ...JSON_SERVER_DIALECT })

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

  /**
   * Patches go on BEFORE filtering, searching and sorting, so a todo whose
   * `completed` the user toggled lands in the right bucket.
   *
   * This used to be a copy of the parent's whole `list()`, taken to get this
   * one line in the right place. The copy then drifted: `search` was added to
   * the original and the todos list went on ignoring it (#2147).
   */
  _transformItems(items) {
    const patches = this._readPatches()
    return items.map((it) => this._applyPatches(it, patches))
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
