/**
 * Number fields and decimals (#2316): fractionDigits, min, max and step reach PrimeVue's InputNumber, and a field
 * without them stays as it was.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputNumber from 'primevue/inputnumber'
import FormInput from '../../src/components/edit/FormInput.vue'

const mountNumber = (field, modelValue = null) =>
  mount(FormInput, {
    props: { field: { type: 'number', ...field }, modelValue },
    global: { plugins: [PrimeVue] },
  })
const inputOf = (wrapper) => wrapper.findComponent(InputNumber)

describe('FormInput number fields (#2316)', () => {
  it('fractionDigits: 2 lets the input take exactly two decimals', () => {
    const input = inputOf(mountNumber({ fractionDigits: 2 }))

    expect(input.props('minFractionDigits')).toBe(2)
    expect(input.props('maxFractionDigits')).toBe(2)
  })

  it('{ min, max } sets a range of decimals, and max is never below min', () => {
    expect(inputOf(mountNumber({ fractionDigits: { max: 3 } })).props()).toMatchObject({ minFractionDigits: 0, maxFractionDigits: 3 })
    expect(inputOf(mountNumber({ fractionDigits: { min: 2, max: 1 } })).props()).toMatchObject({ minFractionDigits: 2, maxFractionDigits: 2 })
  })

  it('min, max and step reach the input', () => {
    expect(inputOf(mountNumber({ min: 0, max: 10, step: 0.5 })).props()).toMatchObject({ min: 0, max: 10, step: 0.5 })
  })

  it('without the options it renders as before, and a stored decimal still shows', () => {
    const wrapper = mountNumber({}, 12.5)
    const input = inputOf(wrapper)

    expect(input.props('minFractionDigits') ?? null).toBeNull()
    expect(input.props('maxFractionDigits') ?? null).toBeNull()
    expect(input.props('useGrouping')).toBe(false)
    // The decimal separator follows the machine's locale: "12.5" or "12,5".
    expect(wrapper.find('input').element.value).toMatch(/^12[.,]5$/)
  })
})
