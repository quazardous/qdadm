---
"@quazardous/qdadm": minor
---

`OAuthCodeAdapter` signs in with any OAuth 2 / OIDC provider: Keycloak, Auth0, Okta, Entra ID (#2264).

It is the authorization code + PKCE flow `GoogleOAuthAdapter` already had, without Google in it:

- `authorizeEndpoint` is required: the provider's authorization URL;
- `authorizeParams` adds provider parameters (`audience`, `kc_idp_hint`, `prompt`…), and refuses the ones the flow sets itself;
- the default redirect is `/auth/callback`.

Your backend still redeems the code, with the same `{ code, codeVerifier, redirectUri }` → `{ token, user }` contract. `GoogleOAuthAdapter` now extends it and behaves as before; it accepts `authorizeParams` too.

New guide: docs/auth-oidc.md, with the backend steps and Keycloak and Auth0 settings.
