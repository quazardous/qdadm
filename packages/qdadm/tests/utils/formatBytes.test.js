/**
 * Sizes in the app's language (#4384): octets in French, the number through
 * Intl, base 1024; useFormatBytes takes the catalogue's units; ShowDisplay
 * has a `bytes` type.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { formatBytes, byteUnits } from '../../src/utils'
import { useFormatBytes } from '../../src/composables/useFormatBytes'
import ShowDisplay from '../../src/components/show/ShowDisplay.vue'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

// Intl groups thousands with a narrow no-break space in French
const plain = (s) => s.replace(/[  ]/g, ' ')

describe('formatBytes (#4384)', () => {
  it('French: o, ko, Mo, Go with a decimal comma', () => {
    expect(formatBytes(0, 'fr')).toBe('0 o')
    expect(formatBytes(512, 'fr')).toBe('512 o')
    expect(formatBytes(1024 * 1024, 'fr')).toBe('1 Mo')
    expect(formatBytes(1.4 * 1024 * 1024, 'fr')).toBe('1,4 Mo')
    expect(plain(formatBytes(1045157, 'fr'))).toBe('1 020,7 ko')
    expect(formatBytes(3 * 1024 ** 3, 'fr-FR')).toBe('3 Go')
  })

  it('English: B, KB, MB, no trailing .0', () => {
    expect(formatBytes(0, 'en')).toBe('0 B')
    expect(formatBytes(1024 * 1024, 'en-US')).toBe('1 MB')
    expect(formatBytes(1.4 * 1024 * 1024, 'en')).toBe('1.4 MB')
    expect(formatBytes(1500, 'de')).toBe('1,5 KB')
  })

  it('a value that rounds up to 1024 moves to the next unit', () => {
    expect(formatBytes(1024 * 1024 - 1, 'fr')).toBe('1 Mo')
    expect(plain(formatBytes(1024 ** 5 * 2, 'fr'))).toBe('2 048 To')
  })

  it('null stays the placeholder; units can be given', () => {
    expect(formatBytes(null, 'fr')).toBe('-')
    expect(formatBytes(undefined)).toBe('-')
    expect(formatBytes(2048, 'en', ['b', 'kio', 'Mio', 'Gio', 'Tio'])).toBe('2 kio')
    expect(byteUnits('fr-CA')).toEqual(['o', 'ko', 'Mo', 'Go', 'To'])
  })
})

describe('useFormatBytes and ShowDisplay (#4384)', () => {
  let i18n
  beforeAll(async () => {
    i18n = new I18n({ defaultLocale: 'fr' })
    await i18n.bootstrap()
  })
  const provide = () => ({ [I18N_INJECTION_KEY]: i18n })

  it('the app language and the catalogue units, which an app can rename', async () => {
    let format
    const Probe = defineComponent({ setup: () => { format = useFormatBytes(); return () => h('div') } })
    mount(Probe, { global: { provide: provide() } })
    expect(format(1.4 * 1024 * 1024)).toBe('1,4 Mo')
    i18n.addMessages('fr', { core: { units: { bytes: { mb: 'mégaoctets' } } } })
    expect(format(1.4 * 1024 * 1024)).toBe('1,4 mégaoctets')
  })

  it('ShowDisplay type bytes', () => {
    const show = (field, value) => mount(ShowDisplay, { props: { field, value }, global: { provide: provide(), stubs: { RouterLink: true, Tag: true } } }).text()
    expect(show({ name: 'size', type: 'bytes' }, 512)).toBe('512 o')
    expect(show({ name: 'size', type: 'bytes', locale: 'en' }, 1536)).toBe('1.5 KB')
    expect(show({ name: 'size', type: 'bytes' }, null)).toBe('-')
  })
})
