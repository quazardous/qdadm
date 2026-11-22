// @vitest-environment node
/**
 * A list row's icon actions sit close (#5450): 2rem round buttons, 2px apart,
 * only inside `.table-actions` (other icon-only buttons keep PrimeVue's size).
 *
 * jsdom has no layout, so this reads the compiled stylesheet itself.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass'

const indexScss = fileURLToPath(new URL('../../src/styles/index.scss', import.meta.url))
const rules = (css) => css.split('}').map((r) => ({ sel: r.slice(0, r.indexOf('{')).trim(), body: r.slice(r.indexOf('{') + 1) }))

describe('row actions spacing (#5450)', () => {
  it('2px between the buttons, each 2rem square, scoped to .table-actions', () => {
    const all = rules(sass.compile(indexScss, { style: 'expanded' }).css)
    const box = all.find((r) => r.sel === '.table-actions')
    expect(box.body).toMatch(/gap:\s*0\.125rem/)
    const btn = all.find((r) => r.sel.startsWith('.table-actions') && /p-button-icon-only/.test(r.sel))
    expect(btn.body).toMatch(/width:\s*2rem/)
    expect(btn.body).toMatch(/height:\s*2rem/)
    expect(btn.body).toMatch(/padding:\s*0/)
  })
})
