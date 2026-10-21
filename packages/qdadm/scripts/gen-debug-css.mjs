/**
 * Generates `src/modules/debug/styles.generated.css` from `styles.scss` (#4140).
 *
 * DebugModule loads its stylesheet when it connects. Loading the `.scss`
 * itself made every app with the debug bar need sass, which nothing told it to
 * install, and `vite build` failed on it. The `.scss` stays the source; the
 * compiled `.css` is committed so the package ships no sass to compile. Run
 * after editing the `.scss`:
 *
 *   npm run gen:debug-css -w packages/qdadm
 *
 * A test (tests/modules/debugCssSync.test.js) fails if they drift.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as sass from 'sass'

const here = dirname(fileURLToPath(import.meta.url))
export const DEBUG_SCSS = join(here, '..', 'src', 'modules', 'debug', 'styles.scss')
export const DEBUG_CSS = join(here, '..', 'src', 'modules', 'debug', 'styles.generated.css')

const BANNER = '/* GENERATED from styles.scss by `npm run gen:debug-css -w packages/qdadm` (#4140) — DO NOT EDIT. */\n'

export function compileDebugCss() {
  // No @charset: it must be the very first thing in a stylesheet, and the
  // banner comes first. The file is UTF-8 and Vite serves it as such.
  const css = sass.compile(DEBUG_SCSS, { style: 'expanded', sourceMap: false, charset: false }).css
  return BANNER + css + '\n'
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const css = compileDebugCss()
  writeFileSync(DEBUG_CSS, css)
  console.log(`generated styles.generated.css (${css.length} bytes)`)
}
