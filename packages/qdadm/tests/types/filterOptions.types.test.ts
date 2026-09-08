/**
 * `addFilter` type-checks its options again (#2147).
 *
 * It took `Omit<FilterConfig, 'name'>`. `FilterConfig` carries an index
 * signature, so `keyof FilterConfig` includes `string`, and
 * `Exclude<string, 'name'>` is still `string` — the `Omit` collapsed to a
 * bare `{ [x: string]: unknown }` and ERASED every declared property.
 *
 * The consequence was not limited to the reported symptom: no filter option
 * was checked at all. `type: 'text'` compiled, and so would
 * `optionLabel: 42` or a misspelled `local_fitler`.
 *
 * The fix is the split — `FilterOptions` declares the properties without
 * `name`, `FilterConfig extends FilterOptions` adds it — so nothing needs
 * `Omit` and the index signature no longer eats the declarations.
 *
 * ONLY A TYPE-CHECKER CAN FAIL THIS FILE. Vitest runs it and asserts the
 * runtime shape, but the real assertion is `@ts-expect-error`: if the checks
 * come back, `vue-tsc` fails on the unused expect-error directives. Run:
 *
 *   npm test          (runtime half)
 *   npm run type-check (the half that matters here)
 */
import { describe, it, expect } from 'vitest'
import { FILTER_TYPES, type FilterOptions, type FilterConfig } from '../../src/composables/useListPage.types'

describe('FilterOptions is actually checked (#2147)', () => {
  it('rejects a type qdadm cannot render', () => {
    // @ts-expect-error 'text' is not a filter type — this is the reported bug
    const bad: FilterOptions = { type: 'text', placeholder: 'Offer ref' }
    expect(bad.type).toBe('text')
  })

  it('rejects a mistyped option value', () => {
    // The collapse hid every option, not just `type`.
    // @ts-expect-error optionLabel is a string
    const bad: FilterOptions = { optionLabel: 42 }
    expect(bad.optionLabel).toBe(42)
  })

  it('accepts every type qdadm does render', () => {
    const good: FilterOptions[] = FILTER_TYPES.map((type) => ({ type }))
    expect(good).toHaveLength(FILTER_TYPES.length)
  })

  it('still accepts an app\'s own extra keys', () => {
    // The index signature stays: apps do stash their own keys, and qdadm
    // itself uses `_filterQuery` and `_cacheOptions`.
    const good: FilterOptions = { type: 'select', myOwnKey: { anything: true } }
    expect(good.myOwnKey).toEqual({ anything: true })
  })

  it('keeps name required on the full config', () => {
    // @ts-expect-error a FilterConfig without a name is not one
    const bad: FilterConfig = { type: 'select' }
    expect(bad.name).toBeUndefined()
  })

  it('accepts a complete config', () => {
    const good: FilterConfig = { name: 'state', type: 'select', options: [] }
    expect(good.name).toBe('state')
  })
})
