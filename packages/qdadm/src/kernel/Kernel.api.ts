import type { AxiosLikeClient, AxiosError } from './Kernel.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

/**
 * Patch Kernel prototype with API client methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyApiMethods(KernelClass: { prototype: any }): void {
  const proto = KernelClass.prototype as Self

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

        if (status === 401 || status === 403) {
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
