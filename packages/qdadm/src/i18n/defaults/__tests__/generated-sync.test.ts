/**
 * Guards the `core.<locale>.yml` → `core.<locale>.generated.ts` pipeline
 * introduced for qdadm #492 (drop the Vite-specific `?raw` import).
 *
 * - Drift guard: the generated module's default export must equal the raw
 *   `.yml` text verbatim. The generator wraps the raw text in a template
 *   literal, which round-trips back to the original — so if you edit a `.yml`
 *   without running `npm run gen:i18n-defaults`, this fails.
 * - End-to-end: the default core provider must load its bundles through the
 *   new (non-`?raw`) import path.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

import enGenerated from '../core.en.generated'
import frGenerated from '../core.fr.generated'
import { createDefaultCoreProvider } from '../DefaultCoreProvider'

const defaultsDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const readYml = (locale: string) =>
  readFileSync(join(defaultsDir, `core.${locale}.yml`), 'utf8')

describe('i18n default providers — generated/.yml sync', () => {
  it('core.en.generated.ts round-trips core.en.yml', () => {
    expect(enGenerated).toBe(readYml('en'))
  })

  it('core.fr.generated.ts round-trips core.fr.yml', () => {
    expect(frGenerated).toBe(readYml('fr'))
  })

  it('default core provider loads bundles via the generated modules', async () => {
    type CoreBundle = { core: { actions: { save: string } } }
    const provider = createDefaultCoreProvider()
    const en = (await provider.load('en')) as CoreBundle
    const fr = (await provider.load('fr')) as CoreBundle
    expect(en.core.actions.save).toBe('Save')
    expect(fr.core.actions.save).toBe('Enregistrer')
  })
})
