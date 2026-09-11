# Sign-in with any OIDC provider

Keycloak, Auth0, Okta, Entra ID, Google: the same flow. Authorization code +
PKCE in the browser, and **your backend** redeems the code and issues its own
session. [Google sign-in](auth-google.md) is this flow with Google's defaults,
and its rules apply here unchanged.

## Front end

```js
import { OAuthCodeAdapter } from '@quazardous/qdadm'

const authAdapter = new OAuthCodeAdapter({
  clientId: 'my-admin',                                    // not a secret
  authorizeEndpoint: 'https://sso.example.com/realms/acme/protocol/openid-connect/auth',
  exchangeUrl: '/auth/oidc/exchange',                      // your backend
  redirectUri: `${window.location.origin}/auth/callback`,  // registered with the provider, exactly
  scopes: ['openid', 'email', 'profile'],
  authorizeParams: {},                                     // provider extras: audience, prompt, kc_idp_hint…
})
```

The browser needs only the authorization endpoint. Discovery, the token
endpoint and the signing keys are the backend's business.

The callback route must be public, and it renders `OAuthCallbackPage`, as in the
[Google guide](auth-google.md#the-callback-route-must-be-public), with your
path:

```js
ctx.routes('/auth', [{
  path: 'callback',
  name: 'oauth-callback',
  component: () => import('@quazardous/qdadm/components').then((m) => m.OAuthCallbackPage),
  meta: { public: true },
}])
```

## Backend

The HTTP contract is [the Google guide's](auth-google.md#the-backend-contract):
`POST <exchangeUrl>` with `{ code, codeVerifier, redirectUri }`, answering
`{ token, user }`. `401` means "we don't know you", `403` "we know you and the
answer is no". What changes per provider is where to find things:

1. **Discover** the provider: `GET <issuer>/.well-known/openid-configuration`
   gives `token_endpoint` and `jwks_uri`.
2. **Exchange** the code at `token_endpoint` with `grant_type=authorization_code`,
   the `code`, the `code_verifier`, the same `redirect_uri`, and your client
   credentials.
3. **Verify the `id_token`**: signature against `jwks_uri`, `iss` equal to the
   issuer, `aud` containing your client id, `exp` in the future.
4. **Map the claims to your user, and its roles to `user.roles`.** qdadm's
   `SecurityChecker` reads `user.roles`: this is where "which roles does this person
   have" is decided, from your own records or from the provider's claims.
5. **Issue your own session** and return it. Never return the provider's tokens.

### Reference: Node with `jose`

```js
import { createRemoteJWKSet, jwtVerify } from 'jose'

const issuer = process.env.OIDC_ISSUER
const discovery = await (await fetch(`${issuer}/.well-known/openid-configuration`)).json()
const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri))

app.post('/auth/oidc/exchange', async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body
  const tokens = await (await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
    }),
  })).json()
  if (!tokens.id_token) return res.status(401).json({ error: 'exchange refused' })

  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: discovery.issuer,
    audience: process.env.OIDC_CLIENT_ID,
  })

  const user = await findOrRefuse({ sub: payload.sub, email: payload.email }) // your rules
  if (!user) return res.status(403).json({ error: 'not authorised' })

  user.roles = rolesFrom(payload) // see the provider sections below
  res.json({ token: await issueSession(user), user })
})
```

## Keycloak

| | |
|---|---|
| `authorizeEndpoint` | `https://<host>/realms/<realm>/protocol/openid-connect/auth` |
| Issuer | `https://<host>/realms/<realm>` |
| Client | *OpenID Connect*, client authentication **on** (confidential), standard flow, PKCE method **S256** |
| Redirect URI | your `redirectUri`, exactly |

Roles are in the `id_token` when the client's *roles* scope is mapped to it:
realm roles in `realm_access.roles`, client roles in
`resource_access.<client-id>.roles`.

```js
const rolesFrom = (claims) =>
  (claims.resource_access?.['my-admin']?.roles ?? claims.realm_access?.roles ?? []).map((r) => `ROLE_${r.toUpperCase()}`)
```

`authorizeParams: { kc_idp_hint: 'google' }` sends users straight to an
identity provider Keycloak brokers.

## Auth0

| | |
|---|---|
| `authorizeEndpoint` | `https://<tenant>.<region>.auth0.com/authorize` (or your custom domain) |
| Issuer | `https://<tenant>.<region>.auth0.com/` (with the trailing slash) |
| Application | *Regular Web Application*, with the redirect URI under *Allowed Callback URLs* |

Auth0 puts no roles in its tokens by default. A post-login **Action** adds them
under a namespaced claim:

```js
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('https://my-admin.example.com/roles', event.authorization?.roles ?? [])
}
```

```js
const rolesFrom = (claims) => claims['https://my-admin.example.com/roles'] ?? []
```

When your backend also calls an API protected by Auth0, request an access token
for it with `authorizeParams: { audience: 'https://api.example.com' }`.

## Refresh and logout

- **Refresh:** add the `offline_access` scope, and keep the refresh token on the
  server. The front never sees it. The Google adapter's `offlineAccess` sends
  Google's own parameters, and is not for other providers.
- **Logout:** end your app's session first. Signing out of the provider as well
  is a redirect to its `end_session_endpoint` (from discovery), which the app
  can do after qdadm's logout.

## Background

`OAuthCodeAdapter` and `GoogleOAuthAdapter` are `@experimental`: see
[API_STABILITY](API_STABILITY.md).
