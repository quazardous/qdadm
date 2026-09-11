/**
 * Sign-in with any OIDC provider, authorization-code + PKCE (#2264).
 *
 * The refusals and the exchange are covered once, through Google, in
 * GoogleOAuthAdapter.test.js. These tests cover what the generic adapter adds:
 * a required authorization endpoint, provider parameters that cannot touch the
 * flow's own, and its own name in errors.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OAuthCodeAdapter, createOAuthCodeAdapter } from '../../src/auth/oauth/OAuthCodeAdapter'
import { GoogleOAuthAdapter } from '../../src/auth/oauth/GoogleOAuthAdapter'

const KEYCLOAK = 'https://sso.example.com/realms/acme/protocol/openid-connect/auth'

function makeAdapter(overrides = {}) {
  return new OAuthCodeAdapter({
    clientId: 'my-admin',
    authorizeEndpoint: KEYCLOAK,
    exchangeUrl: '/auth/oidc/exchange',
    ...overrides,
  })
}

describe('OAuthCodeAdapter', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses to construct without an authorization endpoint', () => {
    expect(() => new OAuthCodeAdapter({ clientId: 'my-admin' })).toThrow(
      /^\[OAuthCodeAdapter\] authorizeEndpoint is required/
    )
  })

  it("sends the browser to the provider's endpoint, with the PKCE flow", async () => {
    const url = new URL(await makeAdapter().buildAuthorizeUrl())

    expect(url.origin + url.pathname).toBe(KEYCLOAK)
    expect(url.searchParams.get('client_id')).toBe('my-admin')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.has('access_type')).toBe(false)
  })

  it('redirects back to /auth/callback on the current origin by default', () => {
    expect(makeAdapter().redirectUri).toBe(`${window.location.origin}/auth/callback`)
  })

  it('adds provider parameters to the authorization URL', async () => {
    const adapter = makeAdapter({ authorizeParams: { audience: 'https://api.example.com', kc_idp_hint: 'google' } })
    const url = new URL(await adapter.buildAuthorizeUrl())

    expect(url.searchParams.get('audience')).toBe('https://api.example.com')
    expect(url.searchParams.get('kc_idp_hint')).toBe('google')
  })

  it("refuses provider parameters that would replace the flow's own", async () => {
    const adapter = makeAdapter({ authorizeParams: { state: 'fixed', code_challenge_method: 'plain' } })

    await expect(adapter.buildAuthorizeUrl()).rejects.toThrow(
      /cannot set state, code_challenge_method/
    )
    // Refused before an attempt is stored: nothing can be completed from it.
    expect(sessionStorage.getItem('qdadm_oauth_attempt')).toBeNull()
  })

  it('names itself in errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' }))
    const adapter = makeAdapter()
    await adapter.buildAuthorizeUrl()
    const { state } = JSON.parse(sessionStorage.getItem('qdadm_oauth_attempt'))

    await expect(adapter.completeLogin({ code: 'c', state })).rejects.toThrow(
      /^\[OAuthCodeAdapter\] exchange failed \(403\)/
    )
  })

  it('has a factory', () => {
    expect(createOAuthCodeAdapter({ clientId: 'x', authorizeEndpoint: KEYCLOAK })).toBeInstanceOf(OAuthCodeAdapter)
  })

  describe('GoogleOAuthAdapter on top of it', () => {
    it("is one, with Google's endpoint and redirect", async () => {
      const google = new GoogleOAuthAdapter({ clientId: 'g' })
      const url = new URL(await google.buildAuthorizeUrl())

      expect(google).toBeInstanceOf(OAuthCodeAdapter)
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(google.redirectUri).toBe(`${window.location.origin}/auth/google/callback`)
    })

    it('keeps provider parameters next to offline access', async () => {
      const google = new GoogleOAuthAdapter({ clientId: 'g', offlineAccess: true, authorizeParams: { hd: 'example.com' } })
      const url = new URL(await google.buildAuthorizeUrl())

      expect(url.searchParams.get('hd')).toBe('example.com')
      expect(url.searchParams.get('access_type')).toBe('offline')
      expect(url.searchParams.get('prompt')).toBe('consent')
    })

    it('still names itself in errors', () => {
      expect(() => new GoogleOAuthAdapter({})).toThrow(/^\[GoogleOAuthAdapter\] clientId is required/)
    })
  })
})
