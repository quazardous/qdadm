import { describe, it, expect } from 'vitest'
import { panelListHeight } from '../../src/components/lists/filters/contract'
import * as qdadm from '../../src/index'

describe('QdMultiFilter panel height (#5470)', () => {
  it('fills the room below a filter near the top of the window', () => {
    // A filter at 100–140px in a 900px window: 760px below, less the panel's chrome (1.5rem)
    expect(panelListHeight({ top: 100, bottom: 140 }, 900)).toBe(760 - 24)
  })

  it('takes the room above when there is more of it (the panel opens upward)', () => {
    expect(panelListHeight({ top: 700, bottom: 740 }, 900)).toBe(700 - 24)
  })

  it('leaves room for the search box when it is shown', () => {
    expect(panelListHeight({ top: 100, bottom: 140 }, 900, { search: true })).toBe(760 - 24 - 52)
  })

  it('never goes under 14rem', () => {
    expect(panelListHeight({ top: 100, bottom: 140 }, 200)).toBe(224)
    expect(panelListHeight({ top: 100, bottom: 140 }, 200, { rem: 20 })).toBe(280)
  })
})

describe('badgeColor export (#5470)', () => {
  it('is exported, and reads tones as the run strip does', () => {
    expect(typeof qdadm.badgeColor).toBe('function')
    expect(qdadm.badgeColor('critical')).toMatch(/var\(--qd-tone-/)
    expect(qdadm.badgeColor('#123456')).toBe('#123456')
    expect(qdadm.badgeColor(null)).toBe(null)
  })
})
