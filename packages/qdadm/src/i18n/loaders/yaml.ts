/**
 * YAML loader factory for LazyTranslationProvider.
 *
 * Given a `locale → () => Promise<{ default: string }>` map, returns a
 * `LazyLoader` that resolves the YAML text for the requested locale and
 * parses it through the `yaml` package.
 *
 * Typical usage with Vite/Vitest `?raw` imports (qdadm-internal default):
 *
 *   const loader = createYamlLoader({
 *     en: () => import('./core.en.yml?raw'),
 *     fr: () => import('./core.fr.yml?raw'),
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
