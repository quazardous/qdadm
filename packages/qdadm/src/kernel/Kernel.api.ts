import type { AxiosLikeClient, AxiosError } from './Kernel.types'
import type { Kernel } from './Kernel'

// #1196 Phase B — this-typing against the real Kernel shape (was Self = any)
type Self = Kernel

/**
 * Patch Kernel prototype with API client methods.
 */
export function applyApiMethods(KernelClass: { prototype: Kernel }): void {
  const proto = KernelClass.prototype

  /**
   * Setup an axios client with automatic auth and error handling
   */
  proto.setupApiClient = function (this: Self, client: AxiosLikeClient): AxiosLikeClient {
    const { authAdapter } = this.options
    const signals = this.signals!
    const debug = this.options.debug ?? false

    client.interceptors.request.use(
      (config) => {
        if (authAdapter?.getToken) {
          const token = authAdapter.getToken()
          if (token) {
            config.headers = config.headers || {}
            config.headers.Authorization = `Bearer ${token}`
          }
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    client.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        const axiosError = error as AxiosError
        const status = axiosError.response?.status
        const url = axiosError.config?.url

        await signals.emit('api:error', {
          status,
          message: axiosError.message,
          url,
          error: axiosError,
        })

        // 401 only, never 403 (#1905 lot F).
        //
        // A 403 says the session is valid and this door is closed. Logging the
        // user out sends them to sign in again for a permission they will not
        // have any more afterwards — a loop, not an error. The 403 still
        // travels as api:error above, which is where a permission refusal
        // belongs.
        if (status === 401) {
          if (debug) {
            console.warn(
              `[Kernel] API ${status} error on ${url}, emitting auth:expired`
            )
          }
          await signals.emit('auth:expired', { status, url })
        }

        return Promise.reject(error)
      }
    )

    this._apiClient = client
    return client
  }

  /**
   * Get the configured API client
   */
  proto.getApiClient = function (this: Self): AxiosLikeClient | null {
    return this._apiClient
  }

  Object.defineProperty(KernelClass.prototype, 'api', {
    get(this: Self): AxiosLikeClient | null {
      return this._apiClient
    },
    configurable: true,
  })
}
