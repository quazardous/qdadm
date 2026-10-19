/**
 * LogStream (#4110): windowed rows, follow and pause, search, errors.
 *
 * jsdom has no layout, so the viewport's geometry is set by hand: 200 px
 * high, rows of 20 px, a scrollHeight that follows the line count.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import LogStream from '../../src/components/display/LogStream.vue'
import { useLogStream } from '../../src/composables/useLogStream'

function geometry(el, getCount) {
  let top = 0
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 200 })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => getCount() * 20 })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v) => (top = Math.max(0, Math.min(v, getCount() * 20 - 200))),
  })
}

function lines(n, make = (i) => `line ${i + 1}`) {
  return Array.from({ length: n }, (_, i) => make(i))
}

async function mountLog(props) {
  const wrapper = mount(LogStream, {
    props,
    global: { plugins: [PrimeVue], directives: { tooltip: {} } },
    attachTo: document.body,
  })
  const viewport = wrapper.find('.qd-log-viewport').element
  geometry(viewport, () => wrapper.vm.log.lines.value.length)
  await flushPromises()
  return { wrapper, viewport }
}

async function scrollTo(viewport, top) {
  viewport.scrollTop = top
  viewport.dispatchEvent(new Event('scroll'))
  await nextTick()
}

describe('LogStream (#4110)', () => {
  it('follows from the first new line when it was mounted before it had a size', async () => {
    // A log in a dialog: mounted with lines, laid out later. The first scroll
    // to the end did nothing; that is not the user scrolling away.
    const stream = useLogStream({ subscribe: () => {} })
    stream.append(lines(50))
    const { viewport } = await mountLog({ stream })
    expect(viewport.scrollTop).toBe(0)
    stream.append(['more'])
    await flushPromises()
    expect(viewport.scrollTop).toBe(51 * 20 - 200)
  })

  it('renders only the rows around the screen on a long log', async () => {
    const { wrapper } = await mountLog({ source: { lines: lines(30_000) }, follow: false })
    const rows = wrapper.findAll('.qd-log-line')
    expect(rows.length).toBeLessThan(100)
    expect(rows[0].text()).toContain('line 1')
  })

  it('follows new lines, pauses when scrolled up, and resumes', async () => {
    const stream = useLogStream({ subscribe: () => {} })
    stream.append(lines(50))
    const { wrapper, viewport } = await mountLog({ stream })

    stream.append(['more'])
    await flushPromises()
    expect(viewport.scrollTop).toBe(51 * 20 - 200)

    // Scrolled up, and new lines land before the scroll event: still paused.
    viewport.scrollTop = 100
    stream.append(['a', 'b', 'c'])
    await flushPromises()
    expect(viewport.scrollTop).toBe(100)
    const resume = wrapper.find('.qd-log-resume')
    expect(resume.exists()).toBe(true)

    await resume.trigger('click')
    await flushPromises()
    expect(viewport.scrollTop).toBe(54 * 20 - 200)
    expect(wrapper.find('.qd-log-resume').exists()).toBe(false)
  })

  it('finds matches, highlights them, and can show only them', async () => {
    const source = { lines: lines(500, (i) => (i % 100 === 42 ? `needle at ${i}` : `hay ${i}`)) }
    const { wrapper, viewport } = await mountLog({ source, follow: false })

    await wrapper.find('input').setValue('NEEDLE')
    expect(wrapper.find('.qd-log-search-count').text()).toBe('0/5')

    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(wrapper.find('.qd-log-search-count').text()).toBe('2/5')
    // Row 142 sits in the middle of the viewport.
    expect(viewport.scrollTop).toBe(142 * 20 - 100)
    const current = wrapper.find('.qd-log-line--current')
    expect(current.find('.qd-log-mark').text()).toBe('needle')

    await wrapper.find('[aria-label="core.log.onlyMatches"]').trigger('click')
    expect(wrapper.findAll('.qd-log-line').map((r) => r.find('.qd-log-n').text())).toEqual(['43', '143', '243', '343', '443'])
  })

  it('counts error lines and jumps to them', async () => {
    const source = { lines: lines(300, (i) => (i === 250 ? '\x1b[31mERROR\x1b[0m boom' : `ok ${i}`)) }
    const { wrapper, viewport } = await mountLog({ source, errorPattern: 'error', follow: false })

    const button = wrapper.find('.qd-log-errors')
    expect(button.text()).toContain('core.log.errors')
    await button.trigger('click')
    await nextTick()
    expect(viewport.scrollTop).toBe(250 * 20 - 100)
    const row = wrapper.find('.qd-log-line--error')
    expect(row.find('.qd-log-n').text()).toBe('251')
    expect(row.find('.qd-log-text span').attributes('style')).toContain('color')
  })

  it('dims a leading timestamp', async () => {
    const { wrapper } = await mountLog({
      source: { lines: ['2026-10-19T19:00:01Z booting'] },
      timestampPattern: '\\d{4}-\\d\\d-\\d\\dT[\\d:]+Z',
    })
    expect(wrapper.find('.qd-log-ts').text()).toBe('2026-10-19T19:00:01Z')
  })

  it('downloads the whole log without escapes', async () => {
    const created = []
    URL.createObjectURL = vi.fn((blob) => (created.push(blob), 'blob:x'))
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { wrapper } = await mountLog({ source: { lines: ['\x1b[32mok\x1b[0m', 'two'] }, filename: 'task-42.log' })

    await wrapper.find('[aria-label="core.log.download"]').trigger('click')
    expect(click).toHaveBeenCalled()
    const text = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsText(created[0])
    })
    expect(text).toBe('ok\ntwo\n')
    click.mockRestore()
  })
})
