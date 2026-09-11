/**
 * A FormField's label names the control inside it (#2268): clicking the label focuses the field, and screen readers
 * and agents read the field by its label.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import FormField from '../../src/components/edit/FormField.vue'
import FormInput from '../../src/components/edit/FormInput.vue'

// jsdom has no matchMedia: PrimeVue's Select and DatePicker ask it for their responsive overlay.
beforeAll(() => {
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
})

const mounted = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

/** Each entry: a FormField with that name and label, around what `control` renders. `forms` copies, in one app. */
function mountFields(entries, forms = 1) {
  const Form = defineComponent({
    render: () =>
      Array.from({ length: forms }, () => h('form', entries.map((e) => h(FormField, { name: e.name, label: e.label }, e.control)))),
  })
  const wrapper = mount(Form, { attachTo: document.body, global: { plugins: [PrimeVue] } })
  mounted.push(wrapper)
  return wrapper
}
const withInput = (field) => ({ name: field.name, label: field.label, control: () => h(FormInput, { field, modelValue: null }) })
const labelsNamed = (text) => [...document.querySelectorAll('label')].filter((l) => l.textContent === text)
const controlOf = (label) => (label.htmlFor ? document.getElementById(label.htmlFor) : null)

describe('FormField labels name their control (#2268)', () => {
  it('every FormInput control is found by its label, inside its own field', () => {
    const fields = [
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'secret', label: 'Secret', type: 'password' },
      { name: 'pages', label: 'Pages', type: 'number' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'available', label: 'Available', type: 'boolean' },
      { name: 'published', label: 'Published', type: 'date' },
    ]
    mountFields(fields.map(withInput))

    for (const f of fields) {
      const [label] = labelsNamed(f.label)
      const control = controlOf(label)
      expect(control, f.label).not.toBeNull()
      expect(['INPUT', 'TEXTAREA'], f.label).toContain(control.tagName)
      expect(control.closest('.form-field'), f.label).toBe(label.closest('.form-field'))
    }
  })

  it('a select is named by its label: the combobox is labelled by it', () => {
    mountFields([withInput({ name: 'genre', label: 'Genre', type: 'select', options: ['Fiction', 'Essay'] })])

    const [label] = labelsNamed('Genre')
    const combobox = controlOf(label)
    expect(combobox.getAttribute('role')).toBe('combobox')
    expect(combobox.getAttribute('aria-labelledby')).toBe(label.id)
  })

  it('two forms with the same field on one page do not share ids', () => {
    mountFields([withInput({ name: 'title', label: 'Title', type: 'text' })], 2)

    const [first, second] = labelsNamed('Title')
    expect(first.htmlFor).not.toBe(second.htmlFor)
    expect(controlOf(first)).not.toBe(controlOf(second))
    expect(controlOf(first).closest('.form-field')).toBe(first.closest('.form-field'))
    expect(controlOf(second).closest('.form-field')).toBe(second.closest('.form-field'))
  })

  it('a control put directly in the slot takes the field id after render', () => {
    mountFields([{ name: 'quotas', label: 'Quotas', control: () => h('input', { class: 'custom' }) }])

    const [label] = labelsNamed('Quotas')
    expect(controlOf(label)).toBe(document.querySelector('input.custom'))
  })

  it('a control with an id of its own keeps it, and the label follows', async () => {
    mountFields([{ name: 'isbn', label: 'ISBN', control: () => h('input', { id: 'my-isbn' }) }])
    await nextTick()

    const [label] = labelsNamed('ISBN')
    expect(label.htmlFor).toBe('my-isbn')
  })

  it('a custom widget a <label for> cannot name gets aria-labelledby', () => {
    mountFields([{ name: 'tags', label: 'Tags', control: () => h('div', { role: 'combobox', tabindex: 0 }) }])

    const [label] = labelsNamed('Tags')
    expect(document.querySelector('[role=combobox]').getAttribute('aria-labelledby')).toBe(label.id)
  })

  it('the slot receives inputId and labelId', () => {
    mountFields([
      { name: 'code', label: 'Code', control: (slot) => h('input', { id: slot.inputId, 'data-label': slot.labelId }) },
    ])

    const [label] = labelsNamed('Code')
    const input = document.querySelector('input[data-label]')
    expect(input.id).toBe(label.htmlFor)
    expect(input.dataset.label).toBe(label.id)
  })

  it('the inputId prop sets the control id, inside a FormField or not', () => {
    const wrapper = mount(FormInput, {
      props: { field: { name: 'title', type: 'text' }, inputId: 'book-title' },
      global: { plugins: [PrimeVue] },
    })
    mounted.push(wrapper)

    expect(wrapper.find('input').attributes('id')).toBe('book-title')
  })
})
