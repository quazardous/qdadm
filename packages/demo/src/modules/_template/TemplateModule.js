/**
 * {{EntityName}} Module - Module Template
 *
 * Copy this directory to create a new module:
 *   cp -r _template {{entity_name}}
 *
 * Then search & replace:
 *   - {{EntityName}} → YourEntity (PascalCase: Books, Users, Products)
 *   - {{entityName}} → yourEntity (camelCase: books, users, products)
 *   - {{entity_name}} → your_entity (snake_case: books, users, products)
 *   - {{Section}} → Navigation Section (e.g., "Library", "Admin")
 *
 * Module Structure:
 * - Storage: Mock/API storage with optional auth protection
 * - Entity: Manager with fields, permissions, optional children
 * - Routes: CRUD routes with single form pattern
 * - Navigation: Nav item in configured section
 */

import { Module, EntityManager, MockApiStorage } from 'qdadm'

// Optionally import auth check from shared config
// import { authCheck } from '../../config/storages'

// ============================================================================
// STORAGE
// ============================================================================

import {{entityName}}Fixture from '../../fixtures/{{entity_name}}.json'

const {{entityName}}Storage = new MockApiStorage({
  entityName: '{{entity_name}}',
  initialData: {{entityName}}Fixture
  // authCheck  // Uncomment to require authentication
})

// ============================================================================
// ENTITY MANAGER (Optional - only if custom permissions needed)
// ============================================================================

// Uncomment to add custom permission logic:
// class {{EntityName}}Manager extends EntityManager {
//   canDelete() {
//     const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
//     return user?.role === 'ROLE_ADMIN'
//   }
// }

// ============================================================================
// MODULE
// ============================================================================

export class {{EntityName}}Module extends Module {
  static name = '{{entity_name}}'
  static requires = []  // Add dependencies: ['other-module']
  static priority = 10  // Lower = loads first

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('{{entity_name}}', {
      name: '{{entity_name}}',
      labelField: 'name',  // Field used for display (e.g., in breadcrumbs)
      fields: {
        name: { type: 'text', label: 'Name', required: true, default: '' },
        description: { type: 'text', label: 'Description', default: '' }
        // Add more fields...
      },
      // children: {
      //   items: { entity: 'items', foreignKey: '{{entity_name}}_id', label: 'Items' }
      // },
      storage: {{entityName}}Storage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('{{entity_name}}', {
      list: () => import('./pages/{{EntityName}}List.vue'),
      form: () => import('./pages/{{EntityName}}Form.vue')
    }, {
      nav: { section: '{{Section}}', icon: 'pi pi-box' }
    })

    // ════════════════════════════════════════════════════════════════════════
    // CUSTOM PAGES (Optional)
    // ════════════════════════════════════════════════════════════════════════
    // ctx.routes('{{entity_name}}/stats', [
    //   { path: '', name: '{{entity_name}}-stats', component: () => import('./pages/{{EntityName}}Stats.vue') }
    // ])
    // ctx.navItem({ section: '{{Section}}', route: '{{entity_name}}-stats', icon: 'pi pi-chart-bar', label: 'Stats' })
  }
}

export default {{EntityName}}Module
