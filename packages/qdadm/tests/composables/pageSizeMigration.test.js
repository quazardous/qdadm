/**
 * Rows-per-page moves into the seam without resetting anybody (#2146).
 *
 * It lived in a bare year-long `qdadm_pageSize` cookie. Now it is one key in
 * the route state, routed by the default composition back to a cookie — so
 * the medium is the same and the shape is not. Somebody who picked 50 rows a
 * year ago must still see 50 after the upgrade: a comfort setting silently
 * resetting is precisely the loss this posture was chosen to avoid.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { restorePageSize, retireLegacyPageSizeCookie } from '../../src/composables/useListPage.utils'

function setLegacyCookie(value) {
  document.cookie = `qdadm_pageSize=${value}; path=/`
}

describe('page size across the move to the seam (#2146)', () => {
  beforeEach(() => {
    retireLegacyPageSizeCookie()
  })

  it('prefers what the seam holds', () => {
    setLegacyCookie(100)
    expect(restorePageSize(50, 10)).toBe(50)
  })

  it('falls back to the legacy cookie when the seam has nothing', () => {
    // The upgrade path: nothing has been written through the seam yet.
    setLegacyCookie(50)
    expect(restorePageSize(undefined, 10)).toBe(50)
  })

  it('lands on the default when neither has anything', () => {
    expect(restorePageSize(undefined, 20)).toBe(20)
  })

  it('refuses a size the paginator cannot offer', () => {
    // The value arrives from a cookie or a query string anyone can edit, and
    // a row count outside the options would leave the dropdown blank.
    for (const bad of [7, 0, -10, 'abc', null, 999]) {
      expect(restorePageSize(bad, 10)).toBe(10)
    }
  })

  it('retires the legacy cookie so it cannot shadow the seam later', () => {
    setLegacyCookie(50)
    expect(restorePageSize(undefined, 10)).toBe(50)

    retireLegacyPageSizeCookie()

    expect(restorePageSize(undefined, 10)).toBe(10)
  })
})
