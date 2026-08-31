/**
 * Google sign-in for qdadm, authorization-code + PKCE (#1775).
 *
 * ## The one rule this class exists to enforce
 *
 * qdadm **never** validates a Google credential in the browser. Decoding a JWT
 * client-side proves nothing: anyone can mint one. The authorization code is
 * therefore useless to the front — it is posted to *your* backend, which
 * exchanges it with Google using the client secret, verifies the identity, and
 * issues **its own** session. That session token is the only thing this adapter
 * ever stores.
 *
 * There is deliberately no code path that turns a Google response into a
 * session without your backend. That is a structural constraint, not advice.
 *
 * ## The backend contract is open
 *
 * `exchangeUrl` receives a POST and returns `{ token, user }`. Nothing about it
 * is JavaScript: implement it in Python, Go, PHP, anything. Because the
 * contract is open, configuration is enough for the common case —
 *
 * ```ts
 * new GoogleOAuthAdapter({
 *   clientId: '…apps.googleusercontent.com',
 *   exchangeUrl: '/auth/google/exchange',
 * })
 * ```
 *
 * — and an app with a Python backend writes no adapter code at all. Override
 * `exchange()` only when your endpoint cannot match the documented shape.
 *
 * See docs/auth-google.md for the wire contract and a reference backend.
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

export interface GoogleOAuthAdapterOptions {
  /** OAuth client id. Not a secret — the client SECRET stays on your backend. */
  clientId: string
  /**
   * Your endpoint that trades the code for a session. POSTed
   * `OAuthExchangePayload`, expected to answer `{ token, user }`.
   */
  exchangeUrl?: string
  /**
   * Where the provider redirects back. Must match a URI registered in the
   * provider console **exactly** — that is the single most common setup
   * failure. Defaults to `/auth/google/callback` on the current origin.
   */
  redirectUri?: string
  /** Scopes requested. Defaults to identity only. */
  scopes?: string[]
  /**
   * Ask for a refresh token. Requires `prompt: 'consent'` on Google to be
   * issued reliably, and the token stays with your backend — the front never
   * sees it.
   */
  offlineAccess?: boolean
  /** localStorage key for the session (see ADR 0008 on shared origins). */
  storageKey?: string
  /** Authorization endpoint. Overridable for tests and for other providers. */
  authorizeEndpoint?: string
}

const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'

export class GoogleOAuthAdapter<TUser extends AuthUser = AuthUser>
  extends LocalStorageSessionAuthAdapter<TUser> {
  protected _clientId: string
  protected _exchangeUrl: string | null
  protected _redirectUri: string
  protected _scopes: string[]
  protected _offlineAccess: boolean
  protected _authorizeEndpoint: string

  constructor(options: GoogleOAuthAdapterOptions) {
    super({ storageKey: options.storageKey ?? 'qdadm_auth' })

    if (!options?.clientId) {
      throw new Error('[GoogleOAuthAdapter] clientId is required')
    }

    this._clientId = options.clientId
    this._exchangeUrl = options.exchangeUrl ?? null
    this._redirectUri =
      options.redirectUri ??
      (typeof window !== 'undefined'
        ? `${window.location.origin}/auth/google/callback`
        : '/auth/google/callback')
    this._scopes = options.scopes ?? ['openid', 'email', 'profile']
    this._offlineAccess = options.offlineAccess ?? false
    this._authorizeEndpoint = options.authorizeEndpoint ?? GOOGLE_AUTHORIZE
  }

  /** The redirect URI this adapter will use — handy for error messages. */
  get redirectUri(): string {
    return this._redirectUri
  }

  /**
   * Build the authorization URL for a fresh attempt.
   *
   * Stashes the PKCE verifier, the CSRF state and where the user was heading,
   * so the callback can finish what this started.
   */
  async buildAuthorizeUrl(redirectTo = '/'): Promise<string> {
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
    if (this._offlineAccess) {
      url.searchParams.set('access_type', 'offline')
      // Google only re-issues a refresh token when consent is asked again.
      url.searchParams.set('prompt', 'consent')
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
   * cannot verify anything Google says.
   */
  async exchange(payload: OAuthExchangePayload): Promise<SessionData<TUser>> {
    if (!this._exchangeUrl) {
      throw new Error(
        '[GoogleOAuthAdapter] no exchangeUrl configured, and exchange() was not overridden. ' +
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
        `[GoogleOAuthAdapter] exchange failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
      )
    }

    const data = (await response.json()) as SessionData<TUser>
    if (!data?.token || !data?.user) {
      throw new Error(
        '[GoogleOAuthAdapter] exchange endpoint must return { token, user } — see docs/auth-google.md'
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
      throw new Error(`[GoogleOAuthAdapter] provider refused the login: ${providerError}`)
    }

    const attempt: StoredAttempt | null = takeAttempt()
    if (!attempt) {
      // No pending attempt: a replayed or bookmarked callback URL. Refusing is
      // the point — the attempt is consumed on read.
      throw new Error('[GoogleOAuthAdapter] no login attempt pending for this callback')
    }

    const state = read('state')
    if (!state || state !== attempt.state) {
      throw new Error('[GoogleOAuthAdapter] state mismatch — refusing the callback')
    }

    const code = read('code')
    if (!code) {
      throw new Error('[GoogleOAuthAdapter] callback carried no authorization code')
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

export function createGoogleOAuthAdapter<TUser extends AuthUser = AuthUser>(
  options: GoogleOAuthAdapterOptions
): GoogleOAuthAdapter<TUser> {
  return new GoogleOAuthAdapter<TUser>(options)
}
