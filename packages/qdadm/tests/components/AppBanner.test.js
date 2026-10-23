/**
 * The top strip (#4200): `app.banner` and `useAppBanner().show()` messages,
 * one at a time with ‹ n/N ›, closable or not; closing shows the next one and
 * an id'd close lasts the session; `--qd-banner-height` follows the strip.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AppBanner from '../../src/components/layout/AppBanner.vue'
import { getAppBannerStore, createAppBannerStore } from '../../src/composables/useAppBanner'

const store = getAppBannerStore()

function mountBanner(banner, slots) {
  return mount(AppBanner, { global: { provide: { qdadmApp: { banner } } }, slots, attachTo: document.body })
}

const height = () => document.documentElement.style.getPropertyValue('--qd-banner-height')
const shown = (w) => w.find('.qd-app-banner-text').text()

beforeEach(() => {
  store.runtime.value = []
  store.dismissed.clear()
  sessionStorage.clear()
  document.documentElement.style.removeProperty('--qd-banner-height')
})

describe('AppBanner (#4200)', () => {
  it('renders nothing without a message, and the offset is 0', async () => {
    const w = mountBanner(undefined)
    await nextTick()
    expect(w.find('.qd-app-banner').exists()).toBe(false)
    expect(height()).toBe('0px')
  })

  it('shows a configured message, not closable by default, and sets the offset', async () => {
    const w = mountBanner({ text: 'PRODUCTION', severity: 'error', link: { label: 'status', href: 'https://status.test' } })
    await nextTick()
    const strip = w.find('.qd-app-banner')
    expect(strip.classes()).toContain('qd-app-banner--error')
    expect(strip.attributes('role')).toBe('status')
    expect(shown(w)).toContain('PRODUCTION')
    expect(w.find('.qd-app-banner-link').attributes('target')).toBe('_blank')
    expect(w.find('.qd-app-banner-close').exists()).toBe(false)
    expect(w.find('.qd-app-banner-nav').exists()).toBe(false)
    expect(height()).toMatch(/px$/)
    w.unmount()
    expect(height()).toBe('0px')
  })

  it('reads a function config reactively', async () => {
    const env = ref('staging')
    const w = mountBanner(() => (env.value === 'prod' ? { text: 'PROD', severity: 'error' } : null))
    await nextTick()
    expect(w.find('.qd-app-banner').exists()).toBe(false)
    env.value = 'prod'
    await nextTick()
    expect(shown(w)).toBe('PROD')
  })

  it('pages through several messages with ‹ n/N ›', async () => {
    const w = mountBanner([{ text: 'one' }, { text: 'two', severity: 'warn' }, { text: 'three' }])
    await nextTick()
    expect(w.find('.qd-app-banner-position').text()).toBe('1/3')
    const [prev, next] = w.findAll('.qd-app-banner-nav button')
    await next.trigger('click')
    expect(shown(w)).toBe('two')
    expect(w.find('.qd-app-banner').classes()).toContain('qd-app-banner--warn')
    await prev.trigger('click')
    await prev.trigger('click')
    expect(shown(w)).toBe('three')
    expect(w.find('.qd-app-banner-position').text()).toBe('3/3')
  })

  it('closing a closable message shows the next one, then the strip goes', async () => {
    const w = mountBanner([
      { id: 'env', text: 'STAGING' },
      { id: 'news', text: 'news', closable: true },
    ])
    store.show({ text: 'maintenance', closable: true })
    await nextTick()
    await w.findAll('.qd-app-banner-nav button')[1].trigger('click')
    expect(shown(w)).toBe('news')
    await w.find('.qd-app-banner-close').trigger('click')
    expect(shown(w)).toBe('maintenance')
    expect(w.find('.qd-app-banner-position').text()).toBe('2/2')
    await w.find('.qd-app-banner-close').trigger('click')
    expect(shown(w)).toBe('STAGING')
    expect(w.find('.qd-app-banner-nav').exists()).toBe(false)
    expect(w.find('.qd-app-banner-close').exists()).toBe(false)
  })

  it('a close with an id lasts the session, even when the app shows it again', async () => {
    const w = mountBanner(null)
    store.show({ id: 'maintenance', text: 'Maintenance at 22:00', closable: true })
    await nextTick()
    await w.find('.qd-app-banner-close').trigger('click')
    expect(w.find('.qd-app-banner').exists()).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('qdadm.banner.dismissed'))).toEqual(['maintenance'])

    // A reload: a fresh store reads the session
    const fresh = createAppBannerStore()
    expect(fresh.dismissed.has('maintenance')).toBe(true)
    // Generated ids are not kept
    const id = store.show({ text: 'no id', closable: true })
    await nextTick()
    await w.find('.qd-app-banner-close').trigger('click')
    expect(JSON.parse(sessionStorage.getItem('qdadm.banner.dismissed'))).not.toContain(id)
  })

  it('show() with a known id replaces the message, hide() removes it, priority goes first', async () => {
    const w = mountBanner({ id: 'env', text: 'STAGING' })
    store.show({ id: 'env', text: 'STAGING — read only' })
    store.show({ id: 'urgent', text: 'outage', severity: 'error', priority: 10 })
    await nextTick()
    expect(shown(w)).toBe('outage')
    expect(w.find('.qd-app-banner-position').text()).toBe('1/2')
    store.hide('urgent')
    await nextTick()
    expect(shown(w)).toBe('STAGING — read only')
  })

  it('the slot replaces the text', async () => {
    const w = mountBanner({ text: 'PROD' }, { default: '<strong class="custom">{{ params.message.text }}!</strong>' })
    await nextTick()
    expect(w.find('.custom').text()).toBe('PROD!')
  })
})
