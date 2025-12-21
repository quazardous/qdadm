/**
 * useApp - Access app branding and configuration
 *
 * Provides access to app config set via createQdadm bootstrap.
 *
 * Usage:
 *   const { name, version, logo } = useApp()
 */

import { inject, computed } from 'vue'

export function useApp() {
  const appConfig = inject('qdadmApp')

  if (!appConfig) {
    console.warn('[qdadm] qdadmApp not provided. Using defaults.')
    return {
      name: 'Admin',
      shortName: 'Admin',
      logo: null,
      logoSmall: null,
      version: null,
      theme: {}
    }
  }

  // Version can be string or callback
  const version = computed(() => {
    if (typeof appConfig.version === 'function') {
      return appConfig.version()
    }
    return appConfig.version
  })

  return {
    name: appConfig.name || 'Admin',
    shortName: appConfig.shortName || appConfig.name || 'Admin',
    logo: appConfig.logo,
    logoSmall: appConfig.logoSmall,
    version,
    theme: appConfig.theme || {}
  }
}
