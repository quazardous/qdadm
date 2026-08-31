/**
 * PKCE and CSRF state for the OAuth authorization-code flow (#1775).
 *
 * No dependency: `crypto.getRandomValues` and `crypto.subtle` exist in every
 * secure context, and `localhost` counts as one.
 *
 * Why both matter, since they are often confused:
 *
 * - **PKCE** protects the authorization code while it travels through the
 *   browser. The code lands on a front-end route and is then posted to your
 *   backend; without the verifier, whoever intercepts it can redeem it.
 * - **`state`** is CSRF protection for the redirect itself: it proves the
 *   callback being handled belongs to a login *this tab* started.
 *
 * Both live in `sessionStorage`, never `localStorage`: they are single-use,
 * they belong to one tab, and they must not outlive it.
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */

/** What one login attempt must remember across the redirect. */
export interface PkceChallenge {
  /** Kept locally, sent to your backend at exchange time — never to Google. */
  verifier: string
  /** Sent to the provider in the authorize URL. */
  challenge: string
  /** CSRF nonce echoed back by the provider. */
  state: string
}

/** The pending attempt, recovered when the provider redirects back. */
export interface StoredAttempt {
  verifier: string
  state: string
  /** Where the user was heading before being sent to the login page. */
  redirectTo: string
}

const STORAGE_KEY = 'qdadm_oauth_attempt'

/** URL-safe base64 without padding, as RFC 7636 requires. */
function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

/**
 * Build a fresh verifier / challenge / state triple.
 *
 * S256 only. The spec still allows `plain`, but `plain` sends the verifier to
 * the authorization server, which defeats the point of having one.
 */
export async function createPkceChallenge(): Promise<PkceChallenge> {
  const verifier = randomString(32)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))

  return { verifier, challenge: base64Url(digest), state: randomString(16) }
}

/** Stash the pending attempt for the trip through the provider. */
export function storeAttempt(attempt: StoredAttempt): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt))
}

/**
 * Recover the pending attempt AND clear it.
 *
 * A login attempt is single-use: a replayed callback URL finds nothing and is
 * rejected, which is half of what `state` is for.
 */
export function takeAttempt(): StoredAttempt | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredAttempt
    if (!parsed?.verifier || !parsed?.state) return null
    return parsed
  } catch {
    return null
  }
}

/** Drop a pending attempt without consuming it (the user backed out). */
export function clearAttempt(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
