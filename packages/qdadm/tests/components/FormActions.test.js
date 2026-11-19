/**
 * The form footer renders the form's delete action in edit mode (#5333).
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FormActions from '../../src/components/edit/FormActions.vue'

const mountActions = (props) => mount(FormActions, { props, global: { directives: { tooltip: {} } } })

describe('FormActions delete (#5333)', () => {
  it('renders the delete action in edit mode, and runs it', async () => {
    const onClick = vi.fn()
    const wrapper = mountActions({ isEdit: true, deleteAction: { label: 'Revoke', icon: 'pi pi-ban', onClick } })
    const button = wrapper.find('.form-actions-delete')
    expect(button.text()).toBe('Revoke')
    await button.trigger('click')
    expect(onClick).toHaveBeenCalled()
  })

  it('not in create mode, nor without the action', () => {
    expect(mountActions({ isEdit: false, deleteAction: { label: 'Delete', onClick: vi.fn() } }).find('.form-actions-delete').exists()).toBe(false)
    expect(mountActions({ isEdit: true }).find('.form-actions-delete').exists()).toBe(false)
  })
})
