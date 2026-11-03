/**
 * Waiting states (#4665): useAsyncRead and its four rules (loading from the
 * start, not read is not empty, pending for a gesture, a failure stops the
 * wait), QdPending the badge, QdPendingZone the area.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import { useAsyncRead, readErrorMessage } from '../../src/composables/useAsyncRead'
import QdPending from '../../src/components/display/QdPending.vue'
import QdPendingZone from '../../src/components/display/QdPendingZone.vue'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

/** A promise settled by hand */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const i18n = new I18n({ defaultLocale: 'en' })
beforeAll(() => i18n.bootstrap())
const global = { plugins: [PrimeVue], provide: { [I18N_INJECTION_KEY]: i18n } }

describe('useAsyncRead (#4665)', () => {
  it('loading from creation; data undefined and not ready until the first answer', async () => {
    const d = deferred()
    const read = useAsyncRead(() => d.promise)
    expect(read.loading.value).toBe(true)
    expect(read.ready.value).toBe(false)
    expect(read.pending.value).toBe(true)
    expect(read.data.value).toBeUndefined()
    d.resolve(['a'])
    await flushPromises()
    expect(read).toMatchObject({ loading: { value: false }, ready: { value: true }, pending: { value: false }, data: { value: ['a'] } })
  })

  it('null and [] are answers: ready, not waiting', async () => {
    for (const answer of [null, []]) {
      const read = useAsyncRead(async () => answer)
      await flushPromises()
      expect(read.ready.value).toBe(true)
      expect(read.data.value).toEqual(answer)
    }
  })

  it('not immediate: idle, still pending for a gesture', () => {
    const read = useAsyncRead(async () => 1, { immediate: false })
    expect(read.loading.value).toBe(false)
    expect(read.pending.value).toBe(true)
  })

  it('a reload keeps the data and is pending; the latest call wins', async () => {
    const answers = [deferred(), deferred(), deferred()]
    let i = 0
    const read = useAsyncRead(() => answers[i++].promise)
    answers[0].resolve('first')
    await flushPromises()
    void read.load()
    void read.load()
    expect(read.data.value).toBe('first')
    expect(read.pending.value).toBe(true)
    answers[2].resolve('third')
    await flushPromises()
    answers[1].resolve('second, late')
    await flushPromises()
    expect(read.data.value).toBe('third')
    expect(read.loading.value).toBe(false)
  })

  it('a failure stops the wait, says why, keeps the data; a retry clears the error', async () => {
    let fail = false
    const read = useAsyncRead(async () => {
      if (fail) throw new Error('agent unreachable')
      return 'good'
    })
    await flushPromises()
    fail = true
    await read.load()
    expect(read.loading.value).toBe(false)
    expect(read.error.value).toBe('agent unreachable')
    expect(read.data.value).toBe('good')
    fail = false
    await read.load()
    expect(read.error.value).toBeNull()
  })

  it('a first read that fails is not ready, and not loading', async () => {
    const read = useAsyncRead(async () => {
      throw { message: 'HTTP 502' }
    })
    await flushPromises()
    expect(read).toMatchObject({ loading: { value: false }, ready: { value: false }, error: { value: 'HTTP 502' } })
    expect(readErrorMessage('plain')).toBe('plain')
  })
})

describe('QdPending (#4665)', () => {
  const badge = (props, slot = ({ value }) => h('b', { class: 'final' }, String(value))) =>
    mount(QdPending, { props, slots: { default: slot }, global })

  it('a neutral spinner badge until the value is defined; null has arrived', async () => {
    const w = badge({ value: undefined, label: 'Reading the deployed code…' })
    const tag = w.find('.qd-pending')
    expect(tag.classes()).toContain('p-tag-secondary')
    expect(tag.attributes('aria-busy')).toBe('true')
    expect(tag.find('.pi-spinner').exists()).toBe(true)
    expect(tag.text()).toBe('Reading the deployed code…')
    expect(w.find('.final').exists()).toBe(false)
    await w.setProps({ value: null })
    expect(w.find('.qd-pending').exists()).toBe(false)
    expect(w.find('.final').text()).toBe('null')
  })

  it('driven by a read: waits on ready, then gives the slot its value', async () => {
    const d = deferred()
    const read = useAsyncRead(() => d.promise)
    const w = badge({ read })
    expect(w.find('.qd-pending').exists()).toBe(true)
    d.resolve('in place')
    await flushPromises()
    expect(w.find('.final').text()).toBe('in place')
  })

  it('a failed read: a muted "unavailable", never a warning colour, the error in its tooltip', async () => {
    const read = useAsyncRead(async () => {
      throw new Error('timeout')
    })
    const w = badge({ read })
    await flushPromises()
    const tag = w.find('.qd-pending--failed')
    expect(tag.classes()).toContain('p-tag-secondary')
    expect(tag.attributes('title')).toBe('timeout')
    expect(tag.text()).toBe('Unavailable')
    expect(tag.find('.pi-spinner').exists()).toBe(false)
    // Retrying: it waits again
    void read.load()
    await nextTick()
    expect(w.find('.qd-pending--failed').exists()).toBe(false)
    expect(w.find('.qd-pending .pi-spinner').exists()).toBe(true)
  })
})

describe('QdPendingZone (#4665)', () => {
  const zone = (props, slots = {}) =>
    mount(QdPendingZone, { props, slots: { default: ({ data }) => h('p', { class: 'content' }, JSON.stringify(data)), ...slots }, global })

  it('a skeleton while the first read runs, aria-busy; then the content', async () => {
    const d = deferred()
    const read = useAsyncRead(() => d.promise)
    const w = zone({ read, lines: 4 })
    expect(w.attributes('aria-busy')).toBe('true')
    expect(w.findAll('.qd-pending-zone-line')).toHaveLength(4)
    expect(w.find('.content').exists()).toBe(false)
    d.resolve([])
    await flushPromises()
    expect(w.attributes('aria-busy')).toBe('false')
    expect(w.find('.content').text()).toBe('[]')
  })

  it('a spinner variant, with its label', () => {
    const w = zone({ loading: true, variant: 'spinner', label: 'Reading the refs…' })
    expect(w.find('.qd-pending-zone-spinner').text()).toBe('Reading the refs…')
  })

  it('a first read that fails: the error and Retry, which reads again', async () => {
    let calls = 0
    const read = useAsyncRead(async () => {
      if (++calls === 1) throw new Error('HTTP 502')
      return 'ok'
    })
    const w = zone({ read })
    await flushPromises()
    expect(w.find('.qd-pending-zone-error').text()).toContain('Could not read: HTTP 502')
    expect(w.find('.qd-pending-zone-line').exists()).toBe(false)
    await w.find('.qd-pending-zone-error button').trigger('click')
    await flushPromises()
    expect(calls).toBe(2)
    expect(w.find('.content').text()).toBe('"ok"')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('a reload keeps the content, dimmed, with a corner spinner', async () => {
    const answers = [deferred(), deferred()]
    let i = 0
    const read = useAsyncRead(() => answers[i++].promise)
    const w = zone({ read })
    answers[0].resolve('v1')
    await flushPromises()
    void read.load()
    await nextTick()
    expect(w.classes()).toContain('qd-pending-zone--reloading')
    expect(w.find('.content').text()).toBe('"v1"')
    expect(w.find('.qd-pending-zone-corner .pi-spinner').exists()).toBe(true)
    answers[1].resolve('v2')
    await flushPromises()
    expect(w.classes()).not.toContain('qd-pending-zone--reloading')
    expect(w.find('.content').text()).toBe('"v2"')
  })

  it('by hand, an error slot of its own', () => {
    const w = zone({ error: 'gone' }, { error: ({ error }) => h('em', { class: 'mine' }, error) })
    expect(w.find('.mine').text()).toBe('gone')
  })

  it('in a page: a gesture waits on pending', async () => {
    const d = deferred()
    const Page = defineComponent({
      setup() {
        const preview = useAsyncRead(() => d.promise)
        return () => h('button', { class: 'deliver', disabled: preview.pending.value }, 'Deliver')
      },
    })
    const w = mount(Page)
    expect(w.find('.deliver').attributes('disabled')).toBeDefined()
    d.resolve({ files: 3 })
    await flushPromises()
    expect(w.find('.deliver').attributes('disabled')).toBeUndefined()
  })
})
