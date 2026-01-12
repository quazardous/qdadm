/**
 * useApp - Access app branding and configuration
 *
 * Provides access to app config set via createQdadm bootstrap.
 *
 * Usage:
 *   const { name, version, logo } = useApp()
 */

import { inject, computed, type ComputedRef } from 'vue'

/**
 * App configuration interface
 */
export interface AppConfig {
  name?: string
  shortName?: string
  logo?: string | null
  logoSmall?: string | null
  version?: string | (() => string) | null
  theme?: Record<string, unknown>
}

/**
 * Return type for useApp
 */
export interface UseAppReturn {
  name: string
  shortName: string
  logo: string | null | undefined
  logoSmall: string | null | undefined
  version: ComputedRef<string | null | undefined>
  theme: Record<string, unknown>
}

export function useApp(): UseAppReturn {
  const appConfig = inject<AppConfig | null>('qdadmApp', null)

  if (!appConfig) {
    console.warn('[qdadm] qdadmApp not provided. Using defaults.')
    return {
      name: 'Admin',
      shortName: 'Admin',
      logo: null,
      logoSmall: null,
      version: computed(() => null),
      theme: {},
    }
  }

  // Version can be string or callback
  const version = computed(() => {
    if (typeof appConfig.version === 'function') {
      return appConfig.version()
    }
    return appConfig.version ?? null
  })

  return {
    name: appConfig.name || 'Admin',
    shortName: appConfig.shortName || appConfig.name || 'Admin',
    logo: appConfig.logo,
    logoSmall: appConfig.logoSmall,
    version,
    theme: appConfig.theme || {},
  }
}
