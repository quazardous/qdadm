/**
 * YAML loader factory for LazyTranslationProvider.
 *
 * Given a `locale → () => Promise<{ default: string }>` map, returns a
 * `LazyLoader` that resolves the YAML text for the requested locale and
 * parses it through the `yaml` package.
 *
 * The importer just needs to resolve to `{ default: <yaml text> }`. qdadm's
 * own defaults import generated `.ts` string modules (see DefaultCoreProvider
 * — bundler-portable, no `?raw`), but a consumer on Vite/Vitest can equally
 * pass `?raw` imports of their own YAML:
 *
 *   const loader = createYamlLoader({
 *     en: () => import('./messages.en.yml?raw'),
 *     fr: () => import('./messages.fr.yml?raw'),
 *   })
 *
 * The dynamic-import boundary is what gives us code-splitting: the YAML for
 * a locale is only fetched + parsed when that locale is requested.
 */

import { parse as parseYaml } from 'yaml'

import type { MessagesBundle } from '@quazardous/qdcore'
import type { LazyLoader } from '../LazyTranslationProvider'

export type YamlTextImport = () => Promise<{ default: string }>

export function createYamlLoader(textImports: Record<string, YamlTextImport>): LazyLoader {
  return async (locale: string) => {
    const importer = textImports[locale]
    if (!importer) return null
    const mod = await importer()
    const parsed = parseYaml(mod.default)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as MessagesBundle
  }
}
