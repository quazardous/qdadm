/**
 * Vite Plugin for qdadm EntityManager Generation
 *
 * Integrates generateManagers with Vite's build pipeline, triggering
 * entity manager file generation during the buildStart hook.
 *
 * @module gen/vite-plugin
 */

import { generateManagers } from './generateManagers.js'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/**
 * Plugin options for qdadmGen
 *
 * @typedef {object} QdadmGenOptions
 * @property {string} [config] - Path to qdadm config file (default: 'qdadm.config.js')
 * @property {string} [output] - Override output directory for generated files
 */

/**
 * Vite plugin for generating EntityManager files at build time
 *
 * Loads the qdadm configuration file and calls generateManagers during
 * Vite's buildStart hook. Supports both ESM and CommonJS config files.
 *
 * @param {QdadmGenOptions} [options={}] - Plugin options
 * @returns {import('vite').Plugin} Vite plugin object
 *
 * @example
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
 *
 * @example
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
 */
export function qdadmGen(options = {}) {
  const configPath = options.config || 'qdadm.config.js'

  return {
    name: 'qdadm-gen',

    async buildStart() {
      try {
        // Resolve config path relative to cwd
        const resolvedConfigPath = resolve(process.cwd(), configPath)

        // Load config file dynamically
        const configUrl = pathToFileURL(resolvedConfigPath).href
        const configModule = await import(configUrl)
        const loadedConfig = configModule.default || configModule

        // Validate loaded config
        if (!loadedConfig || typeof loadedConfig !== 'object') {
          throw new Error(`Invalid qdadm config at '${configPath}': must export an object`)
        }

        if (!loadedConfig.entities) {
          throw new Error(`Invalid qdadm config at '${configPath}': missing 'entities' property`)
        }

        // Merge plugin options with config (plugin options take precedence)
        const mergedConfig = {
          ...loadedConfig,
          ...(options.output && { output: options.output })
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
    }
  }
}
