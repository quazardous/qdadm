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

import { Module, ApiStorage } from 'qdadm'
import axios from 'axios'

// ============================================================================
// STORAGE
// ============================================================================

const jpClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com'
})

const jpUsersStorage = new ApiStorage({ endpoint: '/users', client: jpClient })
const postsStorage = new ApiStorage({ endpoint: '/posts', client: jpClient })
const todosStorage = new ApiStorage({ endpoint: '/todos', client: jpClient })

// ============================================================================
// MODULE
// ============================================================================

export class JsonPlaceholderModule extends Module {
  static name = 'jsonplaceholder'
  static requires = []
  static priority = 0

  async connect(ctx) {
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
  }
}

export default JsonPlaceholderModule
