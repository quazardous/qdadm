/**
 * Default core provider — ships qdadm's `core.*` defaults (EN + FR) as a
 * `LazyTranslationProvider` configured with a YAML loader.
 *
 * The YAML files (`core.en.yml`, `core.fr.yml`) are imported via Vite's
 * `?raw` query so the text is fetched on-demand, then parsed at runtime.
 * Splitting the bundle by locale (and, in the future, by domain) keeps the
 * provider tree-shakeable and translator-friendly.
 *
 * Adding a built-in locale = drop `core.<locale>.yml` next to this file and
 * add it to the loader map below.
 */

import { LazyTranslationProvider } from '../LazyTranslationProvider'
import { createYamlLoader } from '../loaders/yaml'

export function createDefaultCoreProvider(): LazyTranslationProvider {
  const yamlLoader = createYamlLoader({
    en: () => import('./core.en.yml?raw'),
    fr: () => import('./core.fr.yml?raw'),
  })

  return new LazyTranslationProvider({
    name: 'default-core',
    loaders: [yamlLoader],
    locales: ['en', 'fr'],
  })
}
