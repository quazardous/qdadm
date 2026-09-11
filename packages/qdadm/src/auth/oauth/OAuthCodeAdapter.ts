/**
 * Sign-in with any OAuth 2 / OIDC provider, authorization-code + PKCE (#2264).
 *
 * ## The one rule this class exists to enforce
 *
 * qdadm **never** validates a provider credential in the browser. Decoding a
 * JWT client-side proves nothing: anyone can mint one. The authorization code
 * is therefore useless to the front — it is posted to *your* backend, which
 * exchanges it with the provider using the client secret, verifies the
 * identity, and issues **its own** session. That session token is the only
 * thing this adapter ever stores.
 *
 * There is deliberately no code path that turns a provider response into a
 * session without your backend. That is a structural constraint, not advice.
 *
 * ## The backend contract is open
 *
 * `exchangeUrl` receives a POST and returns `{ token, user }`. Nothing about it
 * is JavaScript: implement it in Python, Go, PHP, anything. Keycloak, Auth0,
 * Okta or Entra ID only change the authorization endpoint the browser goes to:
 *
 * ```ts
 * new OAuthCodeAdapter({
 *   clientId: 'my-admin',
 *   authorizeEndpoint: 'https://sso.example.com/realms/acme/protocol/openid-connect/auth',
 *   exchangeUrl: '/auth/oidc/exchange',
 * })
 * ```
 *
 * Override `exchange()` only when your endpoint cannot match the documented
 * shape. See docs/auth-oidc.md for the wire contract and provider examples.
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */

import { LocalStorageSessionAuthAdapter, type AuthUser, type SessionData } from '../SessionAuthAdapter'
import { createPkceChallenge, storeAttempt, takeAttempt, type StoredAttempt } from './pkce'

/** What the front sends your backend. */
export interface OAuthExchangePayload {
  /** The authorization code the provider handed back. */
  code: string
  /** The PKCE verifier that proves this code belongs to this browser. */
  codeVerifier: string
  /** Echoed so the backend can pin the exchange to the same redirect. */
  redirectUri: string
}

export interface OAuthCodeAdapterOptions {
  /** OAuth client id. Not a secret — the client SECRET stays on your backend. */
  clientId: string
  /** The provider's authorization endpoint, where the browser is sent to sign in. */
  authorizeEndpoint: string
  /**
   * Your endpoint that trades the code for a session. POSTed
   * `OAuthExchangePayload`, expected to answer `{ token, user }`.
   */
  exchangeUrl?: string
  /**
   * Where the provider redirects back. Must match a URI registered with the
   * provider **exactly** — that is the single most common setup failure.
   * Defaults to `/auth/callback` on the current origin.
   */
  redirectUri?: string
  /** Scopes requested. Defaults to identity only. */
  scopes?: string[]
  /**
   * Extra query parameters for the authorization URL: `audience` (Auth0),
   * `kc_idp_hint` (Keycloak), `prompt`, `login_hint`… The parameters the flow
   * itself sets (client id, redirect, scope, state, PKCE) cannot be overridden.
   */
  authorizeParams?: Record<string, string>
  /** localStorage key for the session (see ADR 0008 on shared origins). */
  storageKey?: string
}

/** Parameters the flow owns: letting a caller set them would break PKCE or CSRF protection. */
const FLOW_PARAMS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
]

export class OAuthCodeAdapter<TUser extends AuthUser = AuthUser>
  extends LocalStorageSessionAuthAdapter<TUser> {
  /** Prefix of this adapter's error messages. Subclasses name themselves. */
  static readonly label: string = 'OAuthCodeAdapter'
  /** Redirect path on the current origin when `redirectUri` is not given. */
  static readonly defaultRedirectPath: string = '/auth/callback'

  protected _clientId: string
  protected _authorizeEndpoint: string
  protected _exchangeUrl: string | null
  protected _redirectUri: string
  protected _scopes: string[]
  protected _authorizeParams: Record<string, string>

  constructor(options: OAuthCodeAdapterOptions) {
    super({ storageKey: options?.storageKey ?? 'qdadm_auth' })

    if (!options?.clientId) {
      throw new Error(`${this.errorPrefix} clientId is required`)
    }
    if (!options.authorizeEndpoint) {
      throw new Error(`${this.errorPrefix} authorizeEndpoint is required: the provider's authorization URL`)
    }

    this._clientId = options.clientId
    this._authorizeEndpoint = options.authorizeEndpoint
    this._exchangeUrl = options.exchangeUrl ?? null
    const redirectPath = (this.constructor as typeof OAuthCodeAdapter).defaultRedirectPath
    this._redirectUri =
      options.redirectUri ??
      (typeof window !== 'undefined' ? `${window.location.origin}${redirectPath}` : redirectPath)
    this._scopes = options.scopes ?? ['openid', 'email', 'profile']
    this._authorizeParams = { ...(options.authorizeParams ?? {}) }
  }

  /** The redirect URI this adapter will use — handy for error messages. */
  get redirectUri(): string {
    return this._redirectUri
  }

  protected get errorPrefix(): string {
    return `[${(this.constructor as typeof OAuthCodeAdapter).label}]`
  }

  /**
   * Provider-specific query parameters for the authorization URL. Subclasses
   * add their own here (Google's `access_type`, for instance).
   */
  protected extraAuthorizeParams(): Record<string, string> {
    return { ...this._authorizeParams }
  }

  /**
   * Build the authorization URL for a fresh attempt.
   *
   * Stashes the PKCE verifier, the CSRF state and where the user was heading,
   * so the callback can finish what this started.
   */
  async buildAuthorizeUrl(redirectTo = '/'): Promise<string> {
    const extra = this.extraAuthorizeParams()
    const overridden = Object.keys(extra).filter((key) => FLOW_PARAMS.includes(key))
    if (overridden.length > 0) {
      throw new Error(
        `${this.errorPrefix} authorizeParams cannot set ${overridden.join(', ')}: the flow sets them itself`
      )
    }

    const { verifier, challenge, state } = await createPkceChallenge()
    storeAttempt({ verifier, state, redirectTo })

    const url = new URL(this._authorizeEndpoint)
    url.searchParams.set('client_id', this._clientId)
    url.searchParams.set('redirect_uri', this._redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', this._scopes.join(' '))
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    for (const [key, value] of Object.entries(extra)) {
      url.searchParams.set(key, value)
    }

    return url.toString()
  }

  /** Send the browser to the provider. */
  async beginLogin(redirectTo = '/'): Promise<void> {
    window.location.assign(await this.buildAuthorizeUrl(redirectTo))
  }

  /**
   * Trade the code for a session **on your backend**.
   *
   * Override this when your endpoint's shape differs. Whatever you do, the
   * exchange must happen server-side: the browser has no client secret and
   * cannot verify anything the provider says.
   */
  async exchange(payload: OAuthExchangePayload): Promise<SessionData<TUser>> {
    if (!this._exchangeUrl) {
      throw new Error(
        `${this.errorPrefix} no exchangeUrl configured, and exchange() was not overridden. ` +
          'The authorization code must be redeemed by your backend — the browser cannot do it.'
      )
    }

    const response = await fetch(this._exchangeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `${this.errorPrefix} exchange failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
      )
    }

    const data = (await response.json()) as SessionData<TUser>
    if (!data?.token || !data?.user) {
      throw new Error(
        `${this.errorPrefix} exchange endpoint must return { token, user } — see docs/auth-oidc.md`
      )
    }
    return data
  }

  /**
   * Finish the login from the callback route's query string.
   *
   * @returns the session plus where to send the user next.
   * @throws when the provider reported an error, when no attempt is pending,
   *   or when `state` does not match — each of which is a reason to refuse.
   */
  async completeLogin(
    query: URLSearchParams | Record<string, string | undefined>
  ): Promise<SessionData<TUser> & { redirectTo: string }> {
    const read = (key: string): string | undefined =>
      query instanceof URLSearchParams ? (query.get(key) ?? undefined) : query[key]

    const providerError = read('error')
    if (providerError) {
      throw new Error(`${this.errorPrefix} provider refused the login: ${providerError}`)
    }

    const attempt: StoredAttempt | null = takeAttempt()
    if (!attempt) {
      // No pending attempt: a replayed or bookmarked callback URL. Refusing is
      // the point — the attempt is consumed on read.
      throw new Error(`${this.errorPrefix} no login attempt pending for this callback`)
    }

    const state = read('state')
    if (!state || state !== attempt.state) {
      throw new Error(`${this.errorPrefix} state mismatch — refusing the callback`)
    }

    const code = read('code')
    if (!code) {
      throw new Error(`${this.errorPrefix} callback carried no authorization code`)
    }

    const session = await this.exchange({
      code,
      codeVerifier: attempt.verifier,
      redirectUri: this._redirectUri,
    })

    this.setSession(session.token, session.user)
    this.persist()

    return { ...session, redirectTo: attempt.redirectTo || '/' }
  }
}

export function createOAuthCodeAdapter<TUser extends AuthUser = AuthUser>(
  options: OAuthCodeAdapterOptions
): OAuthCodeAdapter<TUser> {
  return new OAuthCodeAdapter<TUser>(options)
}
