/**
 * Vite Plugin for qdadm EntityManager Generation
 *
 * Integrates generateManagers with Vite's build pipeline, triggering
 * entity manager file generation during the buildStart hook.
 *
 * @module gen/vite-plugin
 */

import { generateManagers, type GenerateManagersConfig } from './generateManagers'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Plugin options for qdadmGen
 */
export interface QdadmGenOptions {
  /** Path to qdadm config file (default: 'qdadm.config.js') */
  config?: string
  /** Override output directory for generated files */
  output?: string
}

/**
 * Vite plugin for generating EntityManager files at build time
 *
 * Loads the qdadm configuration file and calls generateManagers during
 * Vite's buildStart hook. Supports both ESM and CommonJS config files.
 *
 * @param options - Plugin options
 * @returns Vite plugin object
 *
 * @example
 * ```ts
 * // vite.config.js
 * import { defineConfig } from 'vite'
 * import { qdadmGen } from 'qdadm/gen/vite-plugin'
 *
 * export default defineConfig({
 *   plugins: [
 *     qdadmGen({
 *       config: './qdadm.config.js',
 *       output: 'src/generated/managers/'
 *     })
 *   ]
 * })
 * ```
 *
 * @example
 * ```ts
 * // qdadm.config.js
 * export default {
 *   output: 'src/generated/managers/',
 *   entities: {
 *     users: {
 *       schema: { name: 'users', fields: { id: { type: 'integer' } } },
 *       endpoint: '/api/users',
 *       storageImport: 'qdadm',
 *       storageClass: 'ApiStorage'
 *     }
 *   }
 * }
 * ```
 */
export function qdadmGen(options: QdadmGenOptions = {}): Plugin {
  const configPath = options.config || 'qdadm.config.js'

  return {
    name: 'qdadm-gen',

    async buildStart() {
      try {
        // Resolve config path relative to cwd
        const resolvedConfigPath = resolve(process.cwd(), configPath)

        // Load config file dynamically
        const configUrl = pathToFileURL(resolvedConfigPath).href
        const configModule = (await import(configUrl)) as {
          default?: GenerateManagersConfig
        } & GenerateManagersConfig
        const loadedConfig = configModule.default || configModule

        // Validate loaded config
        if (!loadedConfig || typeof loadedConfig !== 'object') {
          throw new Error(`Invalid qdadm config at '${configPath}': must export an object`)
        }

        if (!loadedConfig.entities) {
          throw new Error(`Invalid qdadm config at '${configPath}': missing 'entities' property`)
        }

        // Merge plugin options with config (plugin options take precedence)
        const mergedConfig: GenerateManagersConfig = {
          ...loadedConfig,
          ...(options.output && { output: options.output }),
        }

        // Generate managers
        const generatedFiles = await generateManagers(mergedConfig)

        // Log results
        console.log(`[qdadm-gen] Generated ${generatedFiles.length} manager file(s)`)
        for (const file of generatedFiles) {
          console.log(`  - ${file}`)
        }
      } catch (error) {
        // Wrap error with plugin context for clearer messages
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`[qdadm-gen] Failed to generate managers: ${message}`)
      }
    },
  }
}
