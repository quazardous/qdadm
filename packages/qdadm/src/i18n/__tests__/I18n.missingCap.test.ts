/**
 * A missing key is announced once, not on every resolution (#1896).
 *
 * Downstream, seven nav labels fired 1616 `i18n:missing` each in two seconds:
 * every render resolved them, every resolution emitted, and each emission was
 * recorded by two collectors that bumped the tick driving the next render.
 * Capping the signal removes the fuel — the diagnostic value of a missing key
 * is knowing it exists, which takes exactly one signal.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { I18n } from '../I18n'

function makeI18n(options = {}) {
  const emitted: Array<{ signal: string; payload: unknown }> = []
  const signals = {
    emit: (signal: string, payload?: unknown) => {
      emitted.push({ signal, payload })
    },
    on: () => () => {},
  }
  const i18n = new I18n({ disableDefaultCoreBundle: true, ...options }, { signals })
  const missing = () => emitted.filter((e) => e.signal === 'i18n:missing')
  return { i18n, emitted, missing }
}

describe('I18n — missing keys are announced once', () => {
  it('emits once however many times the key is resolved', () => {
    const { i18n, missing } = makeI18n()

    for (let i = 0; i < 200; i++) i18n.t('nav.sections.Control')

    const announced = missing()
    expect(announced).toHaveLength(1)
    expect((announced[0]!.payload as { key: string }).key).toBe('nav.sections.Control')
  })

  it('still announces each distinct key', () => {
    const { i18n, missing } = makeI18n()

    for (let i = 0; i < 50; i++) {
      i18n.t('nav.routes.run')
      i18n.t('nav.routes.job')
      i18n.t('breadcrumb.details')
    }

    expect(missing()).toHaveLength(3)
    expect(missing().map((m) => (m.payload as { key: string }).key).sort()).toEqual([
      'breadcrumb.details',
      'nav.routes.job',
      'nav.routes.run',
    ])
  })

  it('keeps returning the fallback — capping the signal changes no output', () => {
    const { i18n } = makeI18n()

    const first = i18n.t('nav.routes.run')
    const later = i18n.t('nav.routes.run')

    expect(later).toBe(first)
  })

  it('honours emitMissing: false', () => {
    const { i18n, missing } = makeI18n({ emitMissing: false })

    i18n.t('nav.routes.run')

    expect(missing()).toHaveLength(0)
  })

  it('announces again after the locale changes — the fact may no longer hold', async () => {
    const { i18n, missing } = makeI18n()

    i18n.t('nav.routes.run')
    expect(missing()).toHaveLength(1)

    await i18n.changeLocale('fr')
    i18n.t('nav.routes.run')

    expect(missing()).toHaveLength(2)
  })
})
