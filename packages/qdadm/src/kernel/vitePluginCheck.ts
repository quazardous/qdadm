/**
 * Is `qdadmVitePlugin()` in the app's vite config? (#2259)
 *
 * qdadm ships raw sources (ADR 0003), and `qdadmVitePlugin()` is what makes the app and qdadm share one copy
 * of PrimeVue. Without it the app dies at boot on PrimeVue's own `No PrimeVue Toast provided!`, which never
 * names qdadm. The plugin defines `__QDADM_VITE_PLUGIN__`; the kernel checks it once, in dev, and says what to
 * add — a log, not a throw, so an app that wires the same config by hand still boots.
 */
declare const __QDADM_VITE_PLUGIN__: boolean | undefined

export const MISSING_VITE_PLUGIN_HINT =
  'qdadmVitePlugin() is missing from vite.config: without it the app and qdadm can load two copies of PrimeVue, ' +
  "and the app then fails at boot. Add it — import { qdadmVitePlugin } from '@quazardous/qdadm/vite', then " +
  'plugins: [vue(), qdadmVitePlugin()] — see https://github.com/quazardous/qdadm#quick-start'

/** Whether the app was built with the plugin: the define it sets. */
export function hasQdadmVitePlugin(): boolean {
  try {
    return typeof __QDADM_VITE_PLUGIN__ !== 'undefined' && __QDADM_VITE_PLUGIN__ === true
  } catch {
    return false
  }
}

const isDev = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

let warned = false

export interface VitePluginCheckOptions {
  /** Test seams: what the build says, and where the hint goes. */
  present?: boolean
  dev?: boolean
  log?: (message: string) => void
}

/** Log the hint once, in dev, when the plugin is missing. True when it did. */
export function warnWithoutQdadmVitePlugin(options: VitePluginCheckOptions = {}): boolean {
  const present = options.present ?? hasQdadmVitePlugin()
  const dev = options.dev ?? isDev()
  if (present || !dev || warned) return false
  warned = true
  ;(options.log ?? console.error)(`[qdadm] ${MISSING_VITE_PLUGIN_HINT}`)
  return true
}

/** Test seam: forget that the hint was logged. */
export function resetVitePluginWarning(): void {
  warned = false
}

/** PrimeVue's "No PrimeVue Toast provided!", with its usual cause named. Any other error passes through. */
export function explainMissingToast<T>(use: () => T): T {
  try {
    return use()
  } catch (e) {
    if (e instanceof Error && /No PrimeVue Toast provided/i.test(e.message)) {
      throw new Error(`${e.message} The usual cause: ${MISSING_VITE_PLUGIN_HINT}`)
    }
    throw e
  }
}
