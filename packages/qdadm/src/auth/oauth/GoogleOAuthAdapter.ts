/**
 * Google sign-in for qdadm, authorization-code + PKCE (#1775).
 *
 * `OAuthCodeAdapter` with Google's defaults: its authorization endpoint, a
 * `/auth/google/callback` redirect, and `offlineAccess` for a refresh token.
 * The rule and the backend contract are the generic adapter's: the browser
 * never validates a Google credential, your backend redeems the code.
 *
 * ```ts
 * new GoogleOAuthAdapter({
 *   clientId: '…apps.googleusercontent.com',
 *   exchangeUrl: '/auth/google/exchange',
 * })
 * ```
 *
 * See docs/auth-google.md for the wire contract and a reference backend.
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */

import type { AuthUser } from '../SessionAuthAdapter'
import { OAuthCodeAdapter, type OAuthCodeAdapterOptions } from './OAuthCodeAdapter'

export interface GoogleOAuthAdapterOptions extends Omit<OAuthCodeAdapterOptions, 'authorizeEndpoint'> {
  /**
   * Ask for a refresh token. Requires `prompt: 'consent'` on Google to be
   * issued reliably, and the token stays with your backend — the front never
   * sees it.
   */
  offlineAccess?: boolean
  /** Authorization endpoint. Defaults to Google's; overridable for tests. */
  authorizeEndpoint?: string
}

const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'

export class GoogleOAuthAdapter<TUser extends AuthUser = AuthUser>
  extends OAuthCodeAdapter<TUser> {
  static override readonly label: string = 'GoogleOAuthAdapter'
  static override readonly defaultRedirectPath: string = '/auth/google/callback'

  protected _offlineAccess: boolean

  constructor(options: GoogleOAuthAdapterOptions) {
    super({ ...options, authorizeEndpoint: options?.authorizeEndpoint ?? GOOGLE_AUTHORIZE })
    this._offlineAccess = options.offlineAccess ?? false
  }

  protected override extraAuthorizeParams(): Record<string, string> {
    const params = super.extraAuthorizeParams()
    if (this._offlineAccess) {
      params.access_type = 'offline'
      // Google only re-issues a refresh token when consent is asked again.
      params.prompt = 'consent'
    }
    return params
  }
}

export function createGoogleOAuthAdapter<TUser extends AuthUser = AuthUser>(
  options: GoogleOAuthAdapterOptions
): GoogleOAuthAdapter<TUser> {
  return new GoogleOAuthAdapter<TUser>(options)
}
