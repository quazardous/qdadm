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
