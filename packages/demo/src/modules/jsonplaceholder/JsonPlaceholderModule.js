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
        body: { type: 'text', label: 'Body', required: true },
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
    // ROUTES
    // ════════════════════════════════════════════════════════════════════════

    ctx.routes('jp-users', [
      {
        path: '',
        name: 'jp_user',
        component: () => import('../../pages/JpUsersPage.vue'),
        meta: { layout: 'list' }
      },
      {
        path: ':id',
        name: 'jp_user-show',
        component: () => import('../../pages/JpUserDetailPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'jp_users' })

    ctx.routes('posts', [
      {
        path: '',
        name: 'post',
        component: () => import('../posts/pages/PostsPage.vue'),
        meta: { layout: 'list' }
      },
      {
        path: ':id',
        name: 'post-show',
        component: () => import('../posts/pages/PostDetailPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'posts' })

    ctx.routes('todos', [
      {
        path: '',
        name: 'todo',
        component: () => import('../todos/pages/TodosPage.vue'),
        meta: { layout: 'list' }
      }
    ], { entity: 'todos' })

    // ════════════════════════════════════════════════════════════════════════
    // NAVIGATION
    // ════════════════════════════════════════════════════════════════════════

    ctx.navItem({ section: 'JSONPlaceholder', route: 'jp_user', icon: 'pi pi-users', label: 'JP Users' })
    ctx.navItem({ section: 'JSONPlaceholder', route: 'post', icon: 'pi pi-file', label: 'Posts' })
    ctx.navItem({ section: 'JSONPlaceholder', route: 'todo', icon: 'pi pi-check-square', label: 'Todos' })

    // Route families
    ctx.routeFamily('jp_user', ['jp_user-'])
    ctx.routeFamily('post', ['post-'])
    ctx.routeFamily('todo', ['todo-'])
  }
}

export default JsonPlaceholderModule
