/**
 * Reference backend for the google-login example (qdadm #1775).
 *
 * This is the OTHER SIDE of the contract — the side qdadm does not ship,
 * because it must not. Node stdlib only, no dependencies: what matters here is
 * the sequence, not the library. `docs/auth-google.md` specifies the same
 * contract for any language.
 *
 *   POST /auth/google/exchange   { code, codeVerifier, redirectUri } -> { token, user }
 *   GET  /api/me                 the session's user
 *   GET  /api/notes              some data worth signing in for
 *
 * ── Why the browser cannot do this ────────────────────────────────────────
 *
 * Two reasons, and only the first is the obvious one:
 *
 * 1. The exchange needs the client SECRET, which cannot ship in a bundle.
 * 2. Even if it could, a browser verifying Google's answer verifies nothing:
 *    the code doing the checking is the code an attacker controls. Identity
 *    has to be established somewhere the user cannot rewrite.
 *
 * ── What this file cuts corners on, and you must not ──────────────────────
 *
 * Sessions live in a Map and die with the process. The id_token signature is
 * verified against Google's JWKS, because THAT is the step whose absence turns
 * this into an authentication bypass — a forged token with the right shape
 * would otherwise be accepted. Everything else here is a demo shortcut; that
 * one is not optional anywhere.
 *
 * Run: node server.mjs   (or `npm run glogin` from the repo root)
 */
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT ?? 5179)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('[google-login] set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — see .env.example')
  process.exit(1)
}

/** token -> user. A real backend uses its session store. */
const sessions = new Map()

const notes = [
  { id: 1, title: 'Only visible once signed in', body: 'Google said who you are; we decided you may read this.' },
  { id: 2, title: 'The session is ours', body: 'The token in your browser was issued here, not by Google.' },
]

// ── Verifying the id_token ───────────────────────────────────────────────────
// Signature, audience, issuer, expiry. Skipping any of these accepts a forged
// identity, so it is written out rather than delegated to a comment.

let jwksCache = { keys: [], fetchedAt: 0 }

async function googleKeys() {
  if (Date.now() - jwksCache.fetchedAt < 3600_000 && jwksCache.keys.length) return jwksCache.keys
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs')
  const { keys } = await res.json()
  jwksCache = { keys, fetchedAt: Date.now() }
  return keys
}

function b64urlToBuffer(input) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

async function verifyIdToken(idToken) {
  const [headerB64, payloadB64, signatureB64] = idToken.split('.')
  if (!headerB64 || !payloadB64 || !signatureB64) throw new Error('malformed id_token')

  const header = JSON.parse(b64urlToBuffer(headerB64).toString('utf8'))
  const payload = JSON.parse(b64urlToBuffer(payloadB64).toString('utf8'))

  const jwk = (await googleKeys()).find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('id_token signed by an unknown key')

  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  const ok = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    key,
    b64urlToBuffer(signatureB64)
  )
  if (!ok) throw new Error('id_token signature does not verify')

  if (payload.aud !== CLIENT_ID) throw new Error('id_token was issued for another client')
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw new Error('id_token issuer is not Google')
  }
  if (payload.exp * 1000 < Date.now()) throw new Error('id_token has expired')

  return payload
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
  })
}

function userFromSession(req) {
  const auth = req.headers.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  return token ? (sessions.get(token) ?? null) : null
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/auth/google/exchange' && req.method === 'POST') {
    try {
      const { code, codeVerifier, redirectUri } = await readBody(req)
      if (!code || !codeVerifier || !redirectUri) {
        return json(res, 400, { error: 'code, codeVerifier and redirectUri are required' })
      }

      // 1. Redeem the code. The secret and the verifier both belong here.
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenRes.ok) {
        // A code is single-use: a replay lands here, and the front must not
        // retry it. 401 says "we don't know you", never "try again".
        const detail = await tokenRes.text()
        console.warn('[google-login] token exchange refused:', detail.slice(0, 200))
        return json(res, 401, { error: 'google refused the code exchange' })
      }

      const tokens = await tokenRes.json()

      // 2. Verify. Without this the endpoint accepts anything shaped like a JWT.
      const claims = await verifyIdToken(tokens.id_token)

      // 3. Decide. Google says WHO; whether they may enter is your call alone.
      //    A real app looks the identity up and refuses unknown ones — this
      //    demo admits every verified Google account on purpose, and says so.
      const user = {
        id: claims.sub,
        email: claims.email,
        name: claims.name ?? claims.email,
        picture: claims.picture,
      }

      // 4. Issue OUR session. Google's tokens stay here; the browser gets ours.
      const token = crypto.randomUUID()
      sessions.set(token, user)

      return json(res, 200, { token, user })
    } catch (err) {
      console.error('[google-login] exchange failed:', err.message)
      return json(res, 401, { error: err.message })
    }
  }

  if (url.pathname === '/api/me' && req.method === 'GET') {
    const user = userFromSession(req)
    return user ? json(res, 200, user) : json(res, 401, { error: 'no session' })
  }

  if (url.pathname === '/api/notes' && req.method === 'GET') {
    if (!userFromSession(req)) return json(res, 401, { error: 'no session' })
    return json(res, 200, { items: notes, total: notes.length })
  }

  json(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`[google-login] backend on http://localhost:${PORT}`)
})
