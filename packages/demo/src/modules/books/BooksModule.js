/**
 * Books Module - Module System v2 Implementation
 *
 * Class-based module demonstrating qdadm Module System v2 pattern:
 * - Static metadata (name, requires, priority)
 * - Fluent API via KernelContext
 * - Async connect() lifecycle
 *
 * Note: Entity (books) is defined in main.js with EntityManager
 */

import { Module } from 'qdadm'
import { defineAsyncComponent } from 'vue'

const BooksListHeader = defineAsyncComponent(() => import('./components/BooksListHeader.vue'))
const BooksDetailPanel = defineAsyncComponent(() => import('./components/BooksDetailPanel.vue'))

export class BooksModule extends Module {
  static name = 'books'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // Zones - define zones owned by Books module
    ctx
      .zone('books-list-header')
      .zone('books-detail-content')

    // Blocks - register default blocks (with IDs so other modules can target them)
    ctx
      .block('books-list-header', {
        id: 'books-header',
        component: BooksListHeader,
        weight: 50
      })
      .block('books-detail-content', {
        id: 'books-detail',
        component: BooksDetailPanel,
        weight: 50
      })

    // Routes - layout is auto-detected from route names (-create, -edit suffixes)
    ctx.routes('books', [
      {
        path: '',
        name: 'book',
        component: () => import('./pages/BookList.vue'),
        meta: { layout: 'list' }
      },
      {
        path: 'create',
        name: 'book-create',
        component: () => import('./pages/BookCreate.vue')
      },
      {
        path: ':id/edit',
        name: 'book-edit',
        component: () => import('./pages/BookEdit.vue')
      }
    ], { entity: 'books' })

    // Child route: loans for a specific book
    ctx.routes('books/:bookId/loans', [
      {
        path: '',
        name: 'book-loans',
        component: () => import('./pages/BookLoans.vue')
      }
    ], {
      entity: 'loans',
      parent: {
        entity: 'books',
        param: 'bookId',
        foreignKey: 'book_id'
      },
      label: 'Loans'
    })

    // Navigation
    ctx.navItem({
      section: 'Library',
      route: 'book',
      icon: 'pi pi-book',
      label: 'Books'
    })

    // Route family - maps 'book' to all 'book-*' routes for active state in nav
    ctx.routeFamily('book', ['book-'])
  }
}

export default BooksModule
