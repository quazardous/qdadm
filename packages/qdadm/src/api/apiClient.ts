/**
 * Kernel-level default API client (qdadm #1198)
 *
 * Apps already build an axios-compatible HttpClient (base URL + auth
 * interceptors) for their ApiStorages. Registering it once on the kernel
 * makes it available to composables/widgets that need ad-hoc API calls
 * (useOptionsLookup endpoint mode, ScopeEditor), so relative endpoints
 * get base URL + auth applied without per-call wiring:
 *
 *   new Kernel({ apiClient: myAxios })
 */
import { inject } from 'vue'
import type { HttpClient } from '../entity/storage/ApiStorage'

/** Injection key under which the kernel provides the default API client. */
export const API_CLIENT_INJECTION_KEY = 'qdadmApiClient'

/** Accepted forms of the kernel `apiClient` option. */
export type ApiClientSource = HttpClient | (() => HttpClient)

/** Resolve an ApiClientSource (direct instance or factory) to a client. */
export function resolveApiClient(source: ApiClientSource | null | undefined): HttpClient | null {
  if (!source) return null
  return typeof source === 'function' ? source() : source
}

/**
 * Inject the kernel-registered default API client, or null when none is
 * registered. Must be called from a setup context (like any inject).
 */
export function useApiClient(): HttpClient | null {
  const source = inject<ApiClientSource | null>(API_CLIENT_INJECTION_KEY, null)
  return resolveApiClient(source)
}
