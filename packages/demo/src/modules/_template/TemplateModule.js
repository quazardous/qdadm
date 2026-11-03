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
 * It follows docs/RULES.md: the module declares its strings, its entity and
 * its pages in connect(ctx); pages are builders; who may do what is a grant.
 */

import { Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'
import { authCheck } from '../../config/storages'
import {{entityName}}Fixture from '../../fixtures/{{entity_name}}.json'

// ============================================================================
// STORAGE: a fake remote server for the demo (slow calls, rare failures)
// ============================================================================

const {{entityName}}Storage = new MockApiStorage({
  entityName: '{{entity_name}}',
  initialData: {{entityName}}Fixture,
  authCheck,
  latency: [150, 500],
  failRate: 0.02,
})

// ============================================================================
// ENTITY MANAGER (only for a business rule about the record)
// ============================================================================

// Who may do what is a grant in the roles provider (main.js), not code:
// entity:{{entity_name}}:delete for ROLE_ADMIN only = only admins delete.
// Subclass only for a business rule about the record, keeping the grant:
// class {{EntityName}}Manager extends EntityManager {
//   canUpdate(record) {
//     return record?.status !== 'archived' && super.canUpdate(record)
//   }
// }
//
// A call that is not about one record (a lookup, a long task) is a method of
// the manager too, never a fetch in a page:
//   leadTime(id) { return api.get(`/{{entity_name}}/${id}/lead-time`).then((r) => r.data) }

// ============================================================================
// MODULE
// ============================================================================

export class {{EntityName}}Module extends Module {
  static moduleName = '{{entity_name}}'
  static requires = []  // Add dependencies: ['other-module']
  static priority = 10  // Lower = loads first

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // STRINGS: every label on screen, in each language (docs/i18n.md)
    // ════════════════════════════════════════════════════════════════════════
    ctx.messages('en', {
      entities: {
        {{entity_name}}: {
          label: '{{EntityName}}',
          labelPlural: '{{EntityName}}s',
          fields: {
            name: 'Name',
            description: 'Description',
            status: { _label: 'Status', options: { draft: 'Draft', published: 'Published' } },
          },
        },
      },
      // The module's own strings live under its name
      {{entity_name}}: {},
    })
    ctx.messages('fr', {
      entities: {
        {{entity_name}}: {
          label: '{{EntityName}}',
          labelPlural: '{{EntityName}}s',
          fields: {
            name: 'Nom',
            description: 'Description',
            status: { _label: 'Statut', options: { draft: 'Brouillon', published: 'Publié' } },
          },
        },
      },
      {{entity_name}}: {},
    })

    // ════════════════════════════════════════════════════════════════════════
    // ENTITY: fields carry no label, the catalogue gives them
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('{{entity_name}}', new EntityManager({
      name: '{{entity_name}}',
      labelField: 'name',  // Field used for display (e.g., in breadcrumbs)
      fields: {
        name: { type: 'text', required: true, default: '', sortable: true },
        description: { type: 'textarea', default: '' },
        status: {
          type: 'select',
          default: 'draft',
          options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }],
        },
      },
      // children: {
      //   items: { entity: 'items', foreignKey: '{{entity_name}}_id' }
      // },
      storage: {{entityName}}Storage,
    }))

    // ════════════════════════════════════════════════════════════════════════
    // PAGES (ctx.crud: list, show, form; the menu entry follows)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('{{entity_name}}', {
      list: () => import('./pages/{{EntityName}}List.vue'),
      show: () => import('./pages/{{EntityName}}Show.vue'),
      form: () => import('./pages/{{EntityName}}Form.vue'),
    }, {
      nav: { section: '{{Section}}', icon: 'pi pi-box' },
    })
  }
}

export default {{EntityName}}Module
