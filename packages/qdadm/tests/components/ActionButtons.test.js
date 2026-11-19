/**
 * An icon-only row action is named for screen readers and tests (#5323).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionButtons from '../../src/components/lists/ActionButtons.vue'

describe('ActionButtons (#5323)', () => {
  it('gives each button its accessible name, the tooltip by default', () => {
    const wrapper = mount(ActionButtons, {
      props: {
        actions: [
          { name: 'delete', icon: 'pi pi-trash', tooltip: 'Supprimer', ariaLabel: 'Supprimer', severity: 'danger', handler: () => {} },
          { name: 'legacy', icon: 'pi pi-eye', tooltip: 'Voir', severity: 'secondary', handler: () => {} },
        ],
      },
      global: { directives: { tooltip: {} } },
    })
    expect(wrapper.findAll('button').map((b) => b.attributes('aria-label'))).toEqual(['Supprimer', 'Voir'])
  })
})
