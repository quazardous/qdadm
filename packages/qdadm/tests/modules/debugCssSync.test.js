/**
 * The debug bar's committed CSS is the compiled styles.scss (#4140): apps load
 * the CSS, so an edit to the .scss that is not regenerated would never reach them.
 *
 * Run: npm test   (fix: npm run gen:debug-css -w packages/qdadm)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { compileDebugCss, DEBUG_CSS } from '../../scripts/gen-debug-css.mjs'

describe('debug bar stylesheet (#4140)', () => {
  it('matches a fresh compile of styles.scss', () => {
    expect(readFileSync(DEBUG_CSS, 'utf8') === compileDebugCss(), 'styles.generated.css is stale: run npm run gen:debug-css').toBe(true)
  })
})

describe('module stylesheets need no sass (#4140)', () => {
  it('no module loads a .scss at runtime', async () => {
    const { NotificationModule } = await import('../../src/notifications/NotificationModule')
    const { DebugModule } = await import('../../src/modules/debug/DebugModule')
    for (const M of [NotificationModule, DebugModule]) {
      expect(String(M.styles), M.name).not.toMatch(/\.scss/)
    }
  })
})
