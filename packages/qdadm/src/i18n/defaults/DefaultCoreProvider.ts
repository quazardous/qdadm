/**
 * Default core provider — ships qdadm's `core.*` defaults (EN + FR) as a
 * `LazyTranslationProvider` configured with a YAML loader.
 *
 * The YAML text is imported from `core.<locale>.generated.ts` — plain TS
 * modules that `export default` the raw YAML string, generated from the
 * sibling `core.<locale>.yml` source-of-truth (see `scripts/gen-i18n-defaults.mjs`).
 * Using a normal module instead of a Vite `?raw` query keeps the import
 * portable across bundlers and avoids the file:/symlink `server.fs.allow`
 * trap (qdadm #492). The dynamic-import boundary still gives per-locale
 * code-splitting, and the `.yml` files stay translator-friendly.
 *
 * Adding a built-in locale = drop `core.<locale>.yml` next to this file,
 * run `npm run gen:i18n-defaults -w packages/qdadm`, and add the locale to
 * the loader map below.
 */

import { LazyTranslationProvider } from '../LazyTranslationProvider'
import { createYamlLoader } from '../loaders/yaml'

export function createDefaultCoreProvider(): LazyTranslationProvider {
  const yamlLoader = createYamlLoader({
    en: () => import('./core.en.generated'),
    fr: () => import('./core.fr.generated'),
  })

  return new LazyTranslationProvider({
    name: 'default-core',
    loaders: [yamlLoader],
    locales: ['en', 'fr'],
  })
}
