/**
 * The active tab and the open panels are state, not a constant (#2435).
 *
 * FieldGroups initialised Tabs on its first group with a fixed value, and
 * nothing kept the user's choice. `v-model:active` lets an app own it; without
 * it, the component keeps its own copy.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FieldGroups from '../../src/components/item/FieldGroups.vue'

/** PrimeVue's containers, reduced to what matters here: a value in, update:value out. */
const { container, passthrough } = vi.hoisted(() => {
  const { defineComponent, h } = require('vue')
  return {
    container: (name) =>
      defineComponent({
        name,
        props: ['value', 'multiple'],
        emits: ['update:value'],
        setup(_, { slots }) {
          return () => h('div', { class: name }, slots.default?.())
        },
      }),
    passthrough: (name) =>
      defineComponent({ name, setup: (_, { slots }) => () => h('div', { class: name }, slots.default?.()) }),
  }
})

vi.mock('primevue/tabs', () => ({ default: container('Tabs') }))
vi.mock('primevue/accordion', () => ({ default: container('Accordion') }))
vi.mock('primevue/tablist', () => ({ default: passthrough('TabList') }))
vi.mock('primevue/tab', () => ({ default: passthrough('Tab') }))
vi.mock('primevue/tabpanels', () => ({ default: passthrough('TabPanels') }))
vi.mock('primevue/tabpanel', () => ({ default: passthrough('TabPanel') }))
vi.mock('primevue/accordionpanel', () => ({ default: passthrough('AccordionPanel') }))
vi.mock('primevue/accordionheader', () => ({ default: passthrough('AccordionHeader') }))
vi.mock('primevue/accordioncontent', () => ({ default: passthrough('AccordionContent') }))
vi.mock('primevue/tag', () => ({ default: passthrough('Tag') }))
vi.mock('primevue/card', () => ({ default: passthrough('Card') }))
vi.mock('primevue/fieldset', () => ({ default: passthrough('Fieldset') }))

const group = (name) => ({ name, label: name, fields: [], children: [] })
const groups = [group('identity'), group('shortlist'), group('history')]

const mountGroups = (props) => mount(FieldGroups, { props: { groups, data: { id: 1 }, ...props } })

describe('FieldGroups keeps the active group (#2435)', () => {
  describe('tabs', () => {
    it('starts on the first group when nobody says otherwise', () => {
      expect(mountGroups({ layout: 'tabs' }).findComponent({ name: 'Tabs' }).props('value')).toBe('identity')
    })

    it("keeps the user's tab when the record re-renders", async () => {
      const page = mountGroups({ layout: 'tabs' })
      const tabs = page.findComponent({ name: 'Tabs' })

      tabs.vm.$emit('update:value', 'shortlist')
      await page.setProps({ data: { id: 1, refreshed: true } })

      expect(page.findComponent({ name: 'Tabs' }).props('value')).toBe('shortlist')
      expect(page.emitted('update:active')).toEqual([['shortlist']])
    })

    it('follows v-model:active both ways', async () => {
      const page = mountGroups({ layout: 'tabs', active: 'history' })
      expect(page.findComponent({ name: 'Tabs' }).props('value')).toBe('history')

      await page.setProps({ active: 'shortlist' })
      expect(page.findComponent({ name: 'Tabs' }).props('value')).toBe('shortlist')
    })
  })

  describe('accordion', () => {
    it('opens the first group by default, and reports what the user opens', async () => {
      const page = mountGroups({ layout: 'accordion' })
      const accordion = page.findComponent({ name: 'Accordion' })
      expect(accordion.props('value')).toEqual(['identity'])

      accordion.vm.$emit('update:value', ['identity', 'history'])
      await page.setProps({ data: { id: 1, refreshed: true } })

      expect(page.findComponent({ name: 'Accordion' }).props('value')).toEqual(['identity', 'history'])
      expect(page.emitted('update:active')).toEqual([[['identity', 'history']]])
    })

    it('takes a single name for v-model:active too', () => {
      expect(mountGroups({ layout: 'accordion', active: 'shortlist' }).findComponent({ name: 'Accordion' }).props('value')).toEqual(['shortlist'])
    })
  })
})
