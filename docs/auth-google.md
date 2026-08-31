# Google sign-in

Authorization code + PKCE. The browser never decides who someone is: it carries
a code to **your** backend, which redeems it with Google and issues its own
session.

Working example: [`examples/google-login/`](../examples/google-login/) —
`npm run glogin`.

## The rule everything else follows from

**qdadm never validates a Google credential client-side.** Decoding a JWT in a
browser proves nothing — anyone can mint one. So the authorization code is
useless to the front end, and there is deliberately no code path that turns a
provider response into a session without your backend.

If you find yourself wanting to `setSession()` from something Google returned,
stop: that is an authentication bypass, not a shortcut.

## Front-end setup

```js
import { GoogleOAuthAdapter } from '@quazardous/qdadm'

const authAdapter = new GoogleOAuthAdapter({
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  exchangeUrl: '/auth/google/exchange',
  redirectUri: `${window.location.origin}/auth/google/callback`,
})
```

That is the whole integration when your backend implements the contract below.
No subclass, no JavaScript on the server side of the fence.

### The callback route must be public

```js
ctx.routes('/auth/google', [{
  path: 'callback',
  name: 'google-callback',
  component: () => import('@quazardous/qdadm/components').then((m) => m.OAuthCallbackPage),
  meta: { public: true },
}])
```

Without `meta: { public: true }`, the router sends the returning user to the
login page — they are not authenticated *yet*, which is the entire point of the
callback. It fails silently and looks like Google's fault. It isn't.

### The sign-in button

```vue
<LoginPage>
  <template #alternatives>
    <QdButton label="Sign in with Google" icon="pi pi-google"
              @click="authAdapter.beginLogin($route.query.redirect || '/')" />
  </template>
</LoginPage>
```

## The backend contract

This is an **HTTP contract, not a library**. Implement it in whatever you
already run.

### Request

```http
POST <exchangeUrl>
Content-Type: application/json

{
  "code": "4/0AeanS0...",
  "codeVerifier": "dBjftJeZ4CVP...",
  "redirectUri": "http://localhost:5176/auth/google/callback"
}
```

### Response — 200

```json
{
  "token": "your-own-session-token",
  "user": { "id": "42", "email": "someone@example.com", "name": "Someone" }
}
```

`token` is **your** session token. Never return Google's `id_token` or
`access_token`: they are proof of an exchange, not a session you control, and
you cannot revoke them.

### Errors

| Status | Meaning | What the front should do |
|---|---|---|
| `400` | Malformed request, or the code was already redeemed | Back to login; do not retry — codes are single-use |
| `401` | Google rejected the exchange, or the identity failed verification | Back to login |
| `403` | Identity verified, but this user may not enter | Show a refusal; retrying will not help |
| `5xx` | Your side failed | Retrying is reasonable |

Distinguish `401` from `403`: one means "we don't know you", the other "we know
you and the answer is no". Collapsing them sends users into a login loop.

### What your backend MUST do

These are obligations, not suggestions. Skip one and you have an
authentication bypass:

1. **Exchange the code** at `https://oauth2.googleapis.com/token` with your
   `client_id`, `client_secret`, the `code`, the `code_verifier` and the same
   `redirect_uri` the front sent.
2. **Verify the `id_token`** — signature against Google's JWKS, `aud` equal to
   your client id, `iss` one of Google's, `exp` in the future. A library is
   fine; skipping it is not.
3. **Map to your own user.** Google says who someone is, never what they may
   do. Decide whether this identity is allowed in at all.
4. **Issue your own session** and return it.

Keep the refresh token, if you asked for one, on the server. The front has no
use for it and every reason not to see it.

### Reference implementations

Node, using `google-auth-library`:

```js
app.post('/auth/google/exchange', async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  })

  const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirectUri })
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  })
  const { sub, email, name } = ticket.getPayload()

  const user = await findOrRefuse({ googleId: sub, email })   // your rules
  if (!user) return res.status(403).json({ error: 'not authorised' })

  res.json({ token: await issueSession(user), user })
})
```

Python, with `google-auth` and `requests`:

```python
@app.post("/auth/google/exchange")
def exchange():
    body = request.get_json()
    tokens = requests.post("https://oauth2.googleapis.com/token", data={
        "code": body["code"],
        "code_verifier": body["codeVerifier"],
        "redirect_uri": body["redirectUri"],
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "authorization_code",
    }).json()

    claims = google.oauth2.id_token.verify_oauth2_token(
        tokens["id_token"], google.auth.transport.requests.Request(), GOOGLE_CLIENT_ID
    )

    user = find_or_refuse(google_id=claims["sub"], email=claims.get("email"))
    if user is None:
        return {"error": "not authorised"}, 403

    return {"token": issue_session(user), "user": user}
```

Same three endpoints' worth of logic in both. That is the point of specifying
the contract rather than shipping a helper.

## Google Cloud Console

Create an OAuth client of type **Web application**, and register the redirect
URI **exactly** as your app sends it — scheme, host, port and path all match or
Google refuses. A trailing slash counts.

`client_id` is not a secret and can ship in your front-end build.
`client_secret` is, and belongs only on your backend.

In *Testing* mode an External client admits up to 100 named test users without
review, which is enough for development.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` | The URI is not registered, or differs by a character. Compare with `adapter.redirectUri` |
| The callback bounces to login | The callback route is missing `meta: { public: true }` |
| `state mismatch — refusing the callback` | The tab was replaced, `sessionStorage` was cleared, or the URL was replayed. Start again |
| `no login attempt pending` | A bookmarked or reloaded callback URL. Attempts are single-use by design |
| Session lost on reload | Your backend's token was not returned as `token`, or storage is unavailable |

## Security checklist

- The `client_secret` never appears in the front-end build.
- The backend verifies the `id_token`; it does not trust its payload unchecked.
- The response returns your session token, never Google's.
- `401` and `403` are distinguished.
- The refresh token, if any, stays on the server.

## Background

The adapter is `@experimental` — see
[API_STABILITY](API_STABILITY.md).
