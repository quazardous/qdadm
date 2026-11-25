/**
 * A card's size, width × height (#5503): the old names read as one-row
 * sizes, a card's declared span and rows, the picker by click and keyboard,
 * the slot's size given to the card.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import QdCardSizePicker from '../../src/components/layout/QdCardSizePicker.vue'
import QdCardBlockScope from '../../src/cards/QdCardBlockScope.vue'
import { useCardSlotSize } from '../../src/cards/blockLinks'
import {
  normalizeCardSize,
  cardSizes,
  cardSize,
  cardSpan,
  cardRows,
  setSize,
  defaultArrangement,
  reconcileArrangement,
  CARD_SIZES,
} from '../../src/composables/useCardsArrangement'

const c = (id, card = {}) => ({ id, card: { title: id, ...card } })

describe('card sizes, width × height (#5503)', () => {
  it('reads the old names as one-row sizes', () => {
    expect(normalizeCardSize('s')).toBe('1x1')
    expect(normalizeCardSize('m')).toBe('2x1')
    expect(normalizeCardSize('l')).toBe('3x1')
    expect(normalizeCardSize('2x2')).toBe('2x2')
    expect(normalizeCardSize('4x1')).toBe(null)
    expect(normalizeCardSize(3)).toBe(null)
  })

  it('a card allows every size by default, or the ones it declares, old names or new', () => {
    expect(cardSizes(c('a'))).toEqual([...CARD_SIZES])
    expect(cardSizes(c('b', { sizes: ['m', '1x2', 's'] }))).toEqual(['1x1', '2x1', '1x2'])
  })

  it('its default: the declared span × rows', () => {
    const cards = [c('a', { span: 2, rows: 2 }), c('b')]
    const arr = defaultArrangement(cards)
    expect(cardSize(arr, cards[0])).toBe('2x2')
    expect(cardSpan(arr, cards[0])).toBe(2)
    expect(cardRows(arr, cards[0])).toBe(2)
    expect(cardSize(arr, cards[1])).toBe('1x1')
  })

  it('a picked size is saved by its canonical name; an old name picks the same', () => {
    const cards = [c('a')]
    let arr = setSize(defaultArrangement(cards), cards, 'a', '3x2')
    expect(arr.sizes).toEqual({ a: '3x2' })
    expect(cardRows(arr, cards[0])).toBe(2)
    arr = setSize(arr, cards, 'a', 'm')
    expect(arr.sizes).toEqual({ a: '2x1' })
    expect(setSize(arr, cards, 'a', '2x1')).toBe(arr)
    expect(reconcileArrangement({ ...arr, sizes: { a: 'l' } }, cards).sizes).toEqual({ a: '3x1' })
  })
})

describe('QdCardSizePicker (#5503)', () => {
  const mountPicker = (props = {}) =>
    mount(QdCardSizePicker, { attachTo: document.body, props: { modelValue: '1x1', allowed: ['1x1', '2x1', '2x2'], title: 'Orders', ...props } })

  it('shows the size; opens on a 3 × 2 grid, the sizes not allowed greyed out', async () => {
    const w = mountPicker()
    expect(w.find('[data-size-picker]').text()).toBe('1 × 1')
    await w.find('[data-size-picker]').trigger('click')
    expect(w.findAll('.qd-size-picker-cell').map((x) => x.attributes('data-size') + (x.classes('off') ? ':off' : ''))).toEqual(['1x1', '2x1', '3x1:off', '1x2:off', '2x2', '3x2:off'])
    expect(w.find('[data-size="3x1"]').attributes('aria-label')).toBe('3 wide, 1 high (not for this card)')
    w.unmount()
  })

  it('hovering lights the rectangle; a click picks an allowed size, not another', async () => {
    const w = mountPicker()
    await w.find('[data-size-picker]').trigger('click')
    await w.find('[data-size="2x2"]').trigger('pointerenter')
    expect(w.findAll('.qd-size-picker-cell.lit').map((x) => x.attributes('data-size'))).toEqual(['1x1', '2x1', '1x2', '2x2'])
    await w.find('[data-size="3x2"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.find('[data-size="2x2"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['2x2']])
    expect(w.find('.qd-size-picker-panel').exists()).toBe(false)
    w.unmount()
  })

  it('keyboard: the focus on the current size, the arrows move, Enter picks, Escape closes', async () => {
    const w = mountPicker({ modelValue: '2x1' })
    await w.find('[data-size-picker]').trigger('click')
    await nextTick()
    expect(document.activeElement.dataset.size).toBe('2x1')
    await w.find('[data-size="2x1"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement.dataset.size).toBe('2x2')
    await w.find('[data-size="2x2"]').trigger('keydown', { key: 'ArrowRight' })
    await w.find('[data-size="3x2"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement.dataset.size).toBe('3x2')
    await w.find('[data-size="3x2"]').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(w.find('.qd-size-picker-panel').exists()).toBe(false)
    expect(document.activeElement.hasAttribute('data-size-picker')).toBe(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})

describe('the slot size, given to the card (#5503)', () => {
  it('useCardSlotSize reads it under a dashboard slot, null elsewhere', () => {
    let inside, outside
    const Probe = defineComponent({ setup() { const s = useCardSlotSize(); return () => h('i', JSON.stringify(s.value)) } })
    const Out = defineComponent({ setup() { outside = useCardSlotSize(); return () => h('i') } })
    const w = mount(defineComponent({ setup: () => () => h(QdCardBlockScope, { size: '2x2' }, () => h(Probe)) }))
    expect(w.text()).toBe('{"w":2,"h":2}')
    mount(Out)
    expect(outside.value).toBe(null)
  })
})
