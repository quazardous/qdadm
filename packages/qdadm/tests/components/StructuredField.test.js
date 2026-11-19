/**
 * StructuredField (#5333): a structured face and a raw JSON or YAML one of the
 * same value. The raw faces come with the editors/json and editors/yaml entries.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import StructuredField from '../../src/components/editors/structured/StructuredField.vue'
import YamlRawFace from '../../src/components/editors/structured/YamlRawFace.vue'
// What '@quazardous/qdadm/editors/yaml' does on import; the JSON face stays unregistered here
import '../../src/components/editors/structured/registerYaml'

// jsdom has no layout: CodeMirror measures text ranges
Range.prototype.getClientRects ??= () => []
Range.prototype.getBoundingClientRect ??= () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })

vi.mock('primevue/selectbutton', () => ({
  default: {
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    template: `<div><button v-for="o in options" :key="o.value" :class="['opt-' + o.value]" @click="$emit('update:modelValue', o.value)">{{ o.label }}</button></div>`,
  },
}))

describe('StructuredField (#5333)', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('without the format entry, says which import to add', async () => {
    const wrapper = mount(StructuredField, { props: { modelValue: ['a'], format: 'json', defaultMode: 'raw' } })
    await flushPromises()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("@quazardous/qdadm/editors/json"))
    expect(wrapper.find('.raw-view').exists()).toBe(true)
  })

  it('the YAML face writes the value, reads each valid text, and flags an invalid one', async () => {
    const wrapper = mount(StructuredField, {
      props: { modelValue: ['logs:errors:read', '**:read'], format: 'yaml', defaultMode: 'raw', 'onUpdate:modelValue': (v) => wrapper.setProps({ modelValue: v }) },
      slots: { default: '<div class="structured-slot" />' },
    })
    await flushPromises()
    const face = wrapper.findComponent(YamlRawFace)
    const editor = face.findComponent({ name: 'VanillaYamlEditor' })
    expect(editor.props('modelValue')).toBe('- logs:errors:read\n- "**:read"\n')

    editor.vm.$emit('update:modelValue', '- keys:manage\n- cockpit:act\n')
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual(['keys:manage', 'cockpit:act'])

    editor.vm.$emit('update:modelValue', '- [broken')
    await nextTick()
    expect(wrapper.emitted('invalid').at(-1)).toEqual([true])
    expect(wrapper.text()).toContain('Invalid YAML')
    // The guard keeps the raw face while the text is invalid
    await wrapper.find('.opt-structured').trigger('click')
    expect(wrapper.find('.raw-view').exists()).toBe(true)

    editor.vm.$emit('update:modelValue', '- keys:read\n')
    await nextTick()
    await wrapper.find('.opt-structured').trigger('click')
    expect(wrapper.find('.structured-slot').exists()).toBe(true)
    expect(wrapper.props('modelValue')).toEqual(['keys:read'])
  })
})
