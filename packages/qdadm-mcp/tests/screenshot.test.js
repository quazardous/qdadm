// @vitest-environment jsdom
/**
 * DOM screenshots of a scrolled page (#2312): fixed elements land where the user sees them.
 *
 * jsdom draws nothing: the plugin is checked on the clone it rewrites, the picture itself live on the demo.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@zumer/snapdom', () => ({
  snapdom: { toCanvas: vi.fn(async () => ({ width: 1200, height: 800, toDataURL: (type) => `data:${type};base64,QUJD` })) },
}))

import { snapdom } from '@zumer/snapdom'
import { domShot, fixedAtScroll } from '../src/page/screenshot.ts'

const scrolledTo = (y) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true })

afterEach(() => {
  document.body.innerHTML = ''
  scrolledTo(0)
})

/** A qdadm layout: a fixed sidebar, long content, a fixed full-screen overlay — and the clone snapdom would build. */
function layout() {
  document.body.innerHTML =
    '<aside style="position: fixed; top: 0px; left: 0px; width: 240px"></aside>' +
    '<main style="height: 2000px"></main>' +
    '<div class="overlay" style="position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px"></div>'
  const aside = document.querySelector('aside')
  const main = document.querySelector('main')
  const overlay = document.querySelector('.overlay')
  // jsdom lays nothing out: the sizes the demo measured.
  for (const [el, width, height] of [[aside, 240, 995], [overlay, 1600, 995]]) {
    Object.defineProperty(el, 'offsetWidth', { value: width })
    Object.defineProperty(el, 'offsetHeight', { value: height })
  }
  const clone = document.body.cloneNode(true)
  const nodeMap = new Map([
    [clone, document.body],
    [clone.querySelector('aside'), aside],
    [clone.querySelector('main'), main],
    [clone.querySelector('.overlay'), overlay],
  ])
  return { aside, clone, nodeMap }
}

const pinned = (el, property) => [el.style.getPropertyValue(property), el.style.getPropertyPriority(property)]

describe('DOM screenshots of a scrolled page (#2312)', () => {
  it('fixed elements in the clone get the box the user sees; the page itself is untouched', () => {
    const { aside, clone, nodeMap } = layout()
    const before = aside.getAttribute('style')
    scrolledTo(1028)

    fixedAtScroll().afterClone({ clone, nodeMap })

    const sidebar = clone.querySelector('aside')
    expect(pinned(sidebar, 'top')).toEqual(['1028px', 'important'])
    expect(pinned(sidebar, 'left')).toEqual(['0px', 'important'])
    expect(pinned(sidebar, 'height')).toEqual(['995px', 'important'])
    // The overlay spans the viewport, not the whole document.
    const overlay = clone.querySelector('.overlay')
    expect(pinned(overlay, 'top')).toEqual(['1028px', 'important'])
    expect(pinned(overlay, 'bottom')).toEqual(['auto', 'important'])
    expect(pinned(overlay, 'height')).toEqual(['995px', 'important'])
    // Content in the flow is left alone, and so is the live page.
    expect(pinned(clone.querySelector('main'), 'top')).toEqual(['', ''])
    expect(aside.getAttribute('style')).toBe(before)
  })

  it('at the top of the page nothing moves', () => {
    const { clone, nodeMap } = layout()

    fixedAtScroll().afterClone({ clone, nodeMap })

    expect(pinned(clone.querySelector('aside'), 'top')).toEqual(['0px', ''])
  })

  it('only a viewport picture uses it: one element, or the whole page, renders as before', async () => {
    document.body.innerHTML = '<main><h1>Books</h1></main>'

    await domShot({})
    expect(snapdom.toCanvas.mock.lastCall[1].plugins).toEqual([expect.objectContaining({ name: 'qdadm-fixed-at-scroll' })])

    await domShot({ fullPage: true })
    expect(snapdom.toCanvas.mock.lastCall[1].plugins).toBeUndefined()

    await domShot({ element: document.querySelector('h1') })
    expect(snapdom.toCanvas.mock.lastCall[1].plugins).toBeUndefined()
  })
})
