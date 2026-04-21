/**
 * Unit tests for JsonStructuredField component
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import JsonStructuredField from '../../src/components/editors/JsonStructuredField.vue'

// Mock VanillaJsonEditor — the real one needs a DOM editor instance we don't want in jsdom.
// Expose error/update triggers via refs on the wrapper so tests can drive the state machine.
vi.mock('../../src/components/editors/VanillaJsonEditor.vue', () => ({
  default: {
    name: 'VanillaJsonEditor',
    props: ['modelValue', 'mode', 'height'],
    emits: ['update:modelValue', 'error'],
    template: `
      <div class="mock-json-editor">
        <button class="trigger-error" @click="$emit('error', { validationErrors: [{}] })">trigger-error</button>
        <button class="trigger-valid" @click="$emit('update:modelValue', { ok: true })">trigger-valid</button>
      </div>
    `
  }
}))

vi.mock('primevue/selectbutton', () => ({
  default: {
    name: 'SelectButton',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'allowEmpty'],
    emits: ['update:modelValue'],
    template: `
      <div class="mock-select-button">
        <button
          v-for="opt in options"
          :key="opt.value"
          :class="['mode-option', opt.value, { active: modelValue === opt.value }]"
          @click="$emit('update:modelValue', opt.value)"
        >{{ opt.label }}</button>
      </div>
    `
  }
}))

vi.mock('primevue/message', () => ({
  default: {
    name: 'Message',
    props: ['severity', 'closable'],
    template: '<div class="p-message" :class="[`p-message-${severity}`]"><slot /></div>'
  }
}))

function mountField(props = {}) {
  return mount(JsonStructuredField, {
    props: { defaultMode: 'json', ...props },
    slots: { default: '<div class="structured-slot">structured</div>' }
  })
}

describe('JsonStructuredField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('invalid JSON guard', () => {
    it('blocks switch from json to structured when JSON is invalid (default)', async () => {
      const wrapper = mountField({ modelValue: { foo: 1 } })

      // Starts in json mode, trigger an error from the editor
      await wrapper.find('.trigger-error').trigger('click')
      await nextTick()

      // Error banner visible
      expect(wrapper.find('.p-message-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Invalid JSON')

      // Try to switch to structured view
      await wrapper.find('.mode-option.structured').trigger('click')
      await nextTick()

      // Still in json view — slot should NOT be rendered
      expect(wrapper.find('.structured-slot').exists()).toBe(false)
      expect(wrapper.find('.mock-json-editor').exists()).toBe(true)
    })

    it('allows switch once JSON becomes valid again', async () => {
      const wrapper = mountField({ modelValue: { foo: 1 } })

      await wrapper.find('.trigger-error').trigger('click')
      await nextTick()
      // Fix the JSON
      await wrapper.find('.trigger-valid').trigger('click')
      await nextTick()

      // Error banner gone
      expect(wrapper.find('.p-message-error').exists()).toBe(false)

      // Now switch works
      await wrapper.find('.mode-option.structured').trigger('click')
      await nextTick()
      expect(wrapper.find('.structured-slot').exists()).toBe(true)
    })

    it('does not block switch when guardInvalidJson=false', async () => {
      const wrapper = mountField({
        modelValue: { foo: 1 },
        guardInvalidJson: false
      })

      await wrapper.find('.trigger-error').trigger('click')
      await nextTick()

      // Error banner hidden when guard is off
      expect(wrapper.find('.p-message-error').exists()).toBe(false)

      // Switch is allowed even with invalid JSON
      await wrapper.find('.mode-option.structured').trigger('click')
      await nextTick()
      expect(wrapper.find('.structured-slot').exists()).toBe(true)
    })

    it('emits json-error true then false as state changes', async () => {
      const wrapper = mountField({ modelValue: { foo: 1 } })

      await wrapper.find('.trigger-error').trigger('click')
      await nextTick()
      await wrapper.find('.trigger-valid').trigger('click')
      await nextTick()

      const events = wrapper.emitted('json-error')
      expect(events).toBeTruthy()
      expect(events[0]).toEqual([true])
      expect(events[1]).toEqual([false])
    })

    it('uses custom invalidJsonMessage when provided', async () => {
      const wrapper = mountField({
        modelValue: { foo: 1 },
        invalidJsonMessage: 'Custom oops'
      })

      await wrapper.find('.trigger-error').trigger('click')
      await nextTick()

      expect(wrapper.text()).toContain('Custom oops')
    })
  })

  describe('mode toggle (no error)', () => {
    it('switches between json and structured', async () => {
      const wrapper = mountField({ modelValue: { foo: 1 } })

      // Starts json
      expect(wrapper.find('.mock-json-editor').exists()).toBe(true)
      expect(wrapper.find('.structured-slot').exists()).toBe(false)

      // Switch to structured
      await wrapper.find('.mode-option.structured').trigger('click')
      await nextTick()
      expect(wrapper.find('.structured-slot').exists()).toBe(true)
      expect(wrapper.find('.mock-json-editor').exists()).toBe(false)
    })
  })
})
