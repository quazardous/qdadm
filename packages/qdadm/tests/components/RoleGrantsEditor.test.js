/**
 * RoleGrantsEditor (#2313): it emits the role's own composition, and never lets an inherited or covered grant be
 * edited.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleGrantsEditor from '../../src/components/editors/RoleGrantsEditor.vue'
import { PermissionRegistry } from '../../src/security/PermissionRegistry'

function grants() {
  const r = new PermissionRegistry()
  r.registerEntity('books')
  r.register('offers', { rejudge: 'Rejudge an offer' })
  return r.getAll()
}

const mountEditor = (props) =>
  mount(RoleGrantsEditor, {
    props: { grants: grants(), modelValue: { inherits: [], permissions: [] }, ...props },
    global: { stubs: { PermissionEditor: true } },
  })
const box = (wrapper, key) => wrapper.find(`input[data-grant="${key}"]`)
const lastEmit = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]

describe('RoleGrantsEditor (#2313)', () => {
  it('checking a cell or a row emits the composition with that key', async () => {
    const wrapper = mountEditor({ modelValue: { inherits: ['ROLE_USER'], permissions: ['entity:books:read'] } })

    await box(wrapper, 'entity:books:update').setValue(true)
    expect(lastEmit(wrapper)).toEqual({ inherits: ['ROLE_USER'], permissions: ['entity:books:read', 'entity:books:update'] })

    await box(wrapper, 'entity:books:*').setValue(true)
    expect(lastEmit(wrapper).permissions).toEqual(['entity:books:read', 'entity:books:*'])

    await box(wrapper, 'entity:books:read').setValue(false)
    expect(lastEmit(wrapper).permissions).toEqual([])
  })

  it('a grant covered by a wildcard or brought by an inherited role is checked, disabled, and says where it comes from', () => {
    const wrapper = mountEditor({
      modelValue: { inherits: ['ROLE_USER'], permissions: ['entity:books:*'] },
      inherited: [{ permission: 'offers:rejudge', via: 'ROLE_USER' }],
    })

    const covered = box(wrapper, 'entity:books:delete')
    expect(covered.element.checked).toBe(true)
    expect(covered.element.disabled).toBe(true)
    expect(covered.element.parentElement.querySelector('.role-grants-via')).not.toBeNull()

    const inherited = box(wrapper, 'offers:rejudge')
    expect(inherited.element.checked).toBe(true)
    expect(inherited.element.disabled).toBe(true)
    expect(inherited.element.parentElement.querySelector('.role-grants-via')).not.toBeNull()

    expect(box(wrapper, 'entity:books:*').element.disabled).toBe(false)
  })

  it('inherits: roles to pick, this role left out; picking one emits it', async () => {
    const wrapper = mountEditor({
      roles: [{ name: 'ROLE_USER', label: 'User' }, { name: 'ROLE_ADMIN', label: 'Admin' }],
      self: 'ROLE_ADMIN',
    })

    expect(wrapper.findAll('input[data-inherit]').map((i) => i.attributes('data-inherit'))).toEqual(['ROLE_USER'])
    await wrapper.find('input[data-inherit="ROLE_USER"]').setValue(true)
    expect(lastEmit(wrapper)).toEqual({ inherits: ['ROLE_USER'], permissions: [] })
  })

  it('keys the registry does not know are listed and can be removed', async () => {
    const wrapper = mountEditor({ modelValue: { inherits: [], permissions: ['runs:control', 'entity:books:read'] } })

    expect(wrapper.find('[data-grant-other="runs:control"]').exists()).toBe(true)
    await wrapper.find('[data-grant-other="runs:control"] button').trigger('click')
    expect(lastEmit(wrapper).permissions).toEqual(['entity:books:read'])
  })

  it('readonly: every box disabled, nothing to remove or add, nothing emitted', async () => {
    const wrapper = mountEditor({
      readonly: true,
      roles: [{ name: 'ROLE_USER' }],
      modelValue: { inherits: [], permissions: ['runs:control'] },
    })

    expect(wrapper.findAll('input[type="checkbox"]').every((i) => i.element.disabled)).toBe(true)
    expect(wrapper.find('[data-grant-other] button').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'PermissionEditor' }).exists()).toBe(false)
    await box(wrapper, 'entity:books:read').trigger('change')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
