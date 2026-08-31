/**
 * Google sign-in, authorization-code + PKCE (#1775).
 *
 * The tests that matter here are the refusals. A callback handler that accepts
 * what it should reject is an authentication bypass, and every one of these
 * cases is something an attacker or a stale tab will actually produce.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GoogleOAuthAdapter } from '../../src/auth/oauth/GoogleOAuthAdapter'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const REDIRECT = 'http://localhost:5176/auth/google/callback'

function makeAdapter(overrides = {}) {
  return new GoogleOAuthAdapter({
    clientId: CLIENT_ID,
    exchangeUrl: '/auth/google/exchange',
    redirectUri: REDIRECT,
    ...overrides,
  })
}

/** Pull the pending attempt the way the adapter stored it. */
function pendingAttempt() {
  return JSON.parse(sessionStorage.getItem('qdadm_oauth_attempt') || 'null')
}

describe('GoogleOAuthAdapter', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses to construct without a client id', () => {
    expect(() => new GoogleOAuthAdapter({})).toThrow(/clientId is required/)
  })

  describe('authorize URL', () => {
    it('carries PKCE S256 and never the verifier', async () => {
      const adapter = makeAdapter()
      const url = new URL(await adapter.buildAuthorizeUrl('/runs'))

      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe(CLIENT_ID)
      expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT)
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('code_challenge')).toBeTruthy()

      // The verifier is the secret half — it must never reach the provider.
      const verifier = pendingAttempt().verifier
      expect(url.toString()).not.toContain(verifier)
    })

    it('remembers where the user was heading', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl('/runs/42/archives')

      expect(pendingAttempt().redirectTo).toBe('/runs/42/archives')
    })

    it('mints a fresh verifier and state per attempt', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()
      const first = pendingAttempt()
      await adapter.buildAuthorizeUrl()
      const second = pendingAttempt()

      expect(second.verifier).not.toBe(first.verifier)
      expect(second.state).not.toBe(first.state)
    })

    it('asks for consent when offline access is requested', async () => {
      const adapter = makeAdapter({ offlineAccess: true })
      const url = new URL(await adapter.buildAuthorizeUrl())

      // Google only re-issues a refresh token when consent is asked again.
      expect(url.searchParams.get('access_type')).toBe('offline')
      expect(url.searchParams.get('prompt')).toBe('consent')
    })
  })

  describe('completeLogin — the refusals', () => {
    it('refuses a callback with no pending attempt (replayed URL)', async () => {
      const adapter = makeAdapter()

      await expect(
        adapter.completeLogin({ code: 'abc', state: 'whatever' })
      ).rejects.toThrow(/no login attempt pending/)
    })

    it('refuses a state mismatch', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()

      await expect(
        adapter.completeLogin({ code: 'abc', state: 'forged' })
      ).rejects.toThrow(/state mismatch/)
    })

    it('refuses to replay a callback that already succeeded', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()
      const { state } = pendingAttempt()
      vi.spyOn(adapter, 'exchange').mockResolvedValue({
        token: 't',
        user: { id: '1' },
      })

      await adapter.completeLogin({ code: 'abc', state })
      // The attempt is consumed on read, so the same URL cannot be reused.
      await expect(adapter.completeLogin({ code: 'abc', state })).rejects.toThrow(
        /no login attempt pending/
      )
    })

    it('surfaces a provider refusal instead of proceeding', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()

      await expect(adapter.completeLogin({ error: 'access_denied' })).rejects.toThrow(
        /provider refused/
      )
    })

    it('refuses a callback carrying no code', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()
      const { state } = pendingAttempt()

      await expect(adapter.completeLogin({ state })).rejects.toThrow(/no authorization code/)
    })

    it('refuses when no backend can redeem the code', async () => {
      const adapter = makeAdapter({ exchangeUrl: undefined })
      await adapter.buildAuthorizeUrl()
      const { state } = pendingAttempt()

      // The browser has no client secret: without a backend there is no path.
      await expect(adapter.completeLogin({ code: 'abc', state })).rejects.toThrow(
        /must be redeemed by your backend/
      )
    })
  })

  describe('completeLogin — the happy path', () => {
    it('posts code + verifier to the backend and stores ITS session', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl('/runs')
      const { state, verifier } = pendingAttempt()

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'session-from-our-backend', user: { id: '7', email: 'a@b.c' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.completeLogin({ code: 'the-code', state })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/auth/google/exchange')
      expect(JSON.parse(init.body)).toEqual({
        code: 'the-code',
        codeVerifier: verifier,
        redirectUri: REDIRECT,
      })

      // The stored token is the BACKEND's session, never anything from Google.
      expect(adapter.getToken()).toBe('session-from-our-backend')
      expect(adapter.isAuthenticated()).toBe(true)
      expect(result.redirectTo).toBe('/runs')
    })

    it('survives a reload — the session is persisted', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()
      const { state } = pendingAttempt()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ token: 'tok', user: { id: '9' } }),
        })
      )

      await adapter.completeLogin({ code: 'c', state })

      const reloaded = makeAdapter()
      expect(reloaded.getToken()).toBe('tok')
    })

    it('reports a failing exchange with its status', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()
      const { state } = pendingAttempt()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad code' })
      )

      await expect(adapter.completeLogin({ code: 'c', state })).rejects.toThrow(/exchange failed \(401\)/)
    })

    it('rejects a backend answer that is not { token, user }', async () => {
      const adapter = makeAdapter()
      await adapter.buildAuthorizeUrl()
      const { state } = pendingAttempt()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'oops' }) })
      )

      await expect(adapter.completeLogin({ code: 'c', state })).rejects.toThrow(/must return \{ token, user \}/)
    })
  })
})
