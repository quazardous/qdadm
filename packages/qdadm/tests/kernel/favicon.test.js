/**
 * Page icon (#4166): an explicit app.favicon wins; without one, the page's own
 * link[rel~=icon] stays and the qdadm logo is only a fallback; false / null
 * leave the head alone.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { applyFavicon } from '../../src/plugin'

const icons = () => [...document.head.querySelectorAll("link[rel~='icon']")].map((l) => l.getAttribute('href'))
const pageIcon = (href) => {
  const link = document.createElement('link')
  link.setAttribute('rel', 'icon')
  link.setAttribute('href', href)
  document.head.appendChild(link)
}

beforeEach(() => {
  document.head.innerHTML = ''
})

describe('applyFavicon (#4166)', () => {
  it('an explicit favicon replaces the page icon, or is added', () => {
    pageIcon('/src/icon.svg')
    applyFavicon('/brand.svg')
    expect(icons()).toEqual(['/brand.svg'])

    document.head.innerHTML = ''
    applyFavicon('/brand.svg')
    expect(icons()).toEqual(['/brand.svg'])
  })

  it('without one, keeps the page icon', () => {
    pageIcon('/src/icon.svg')
    applyFavicon(undefined)
    expect(icons()).toEqual(['/src/icon.svg'])
  })

  it('without one and without a page icon, adds the qdadm logo', () => {
    applyFavicon(undefined)
    const [href] = icons()
    expect(href).toBeTruthy()
    expect(icons()).toHaveLength(1)
  })

  it('false or null never touches the head', () => {
    applyFavicon(false)
    applyFavicon(null)
    expect(icons()).toEqual([])
    pageIcon('/src/icon.svg')
    applyFavicon(false)
    expect(icons()).toEqual(['/src/icon.svg'])
  })
})
