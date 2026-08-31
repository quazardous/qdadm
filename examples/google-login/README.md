# Google sign-in — reference implementation

Authorization code + PKCE, end to end: the browser carries a code, the backend
redeems it and issues its own session.

**Dev-only.** Not deployed to GitHub Pages, unlike `hello-world` and
`tutorial-mini-admin`: it needs a backend holding a client secret, which a
static build cannot have.

## Setup

1. Google Cloud console → *APIs & Services* → *Credentials* → *Create
   credentials* → *OAuth client ID* → **Web application**.
2. Register this redirect URI, exactly — scheme, host, port, path:
   ```
   http://localhost:5176/auth/google/callback
   ```
3. `cp .env.example .env` and fill in the two values.
4. From the repo root:
   ```sh
   npm run glogin
   ```
5. Open <http://localhost:5176>, click **Sign in with Google**.

In *Testing* mode an External client admits up to 100 named test users without
review — enough for development.

## What to read, in order

| File | What it shows |
|---|---|
| [`server.mjs`](server.mjs) | **The other side of the contract.** Node stdlib only; the id_token verification is written out rather than delegated, because that step is what stands between you and an authentication bypass |
| [`main.js`](main.js) | The adapter, and the callback route that **must** be public |
| [`Login.vue`](Login.vue) | The button in the `#alternatives` slot, preserving where the user was heading |
| [`NoteList.vue`](NoteList.vue) | Notable for knowing nothing about Google |

## The asymmetry that is the security model

`VITE_GOOGLE_CLIENT_ID` ships in the bundle and is **not** a secret.
`GOOGLE_CLIENT_SECRET` never leaves `server.mjs`.

That is not a convention — it is why the flow works. The browser cannot redeem
a code, and cannot verify Google's answer either: the code doing the checking
would be the code an attacker controls. Identity has to be established
somewhere the user cannot rewrite.

## What this demo cuts corners on

Sessions live in a `Map` and die with the process, and **every verified Google
account is admitted**. A real backend looks the identity up and refuses the
ones it does not know — Google says *who* someone is, never *whether they may
enter*. That step is marked in `server.mjs`; it is the one to replace first.

The `id_token` signature check is *not* a corner cut. Without it the endpoint
accepts anything shaped like a JWT.

## Your own backend

The contract is HTTP, not JavaScript:
[`docs/auth-google.md`](../../docs/auth-google.md) specifies it with a Python
sketch alongside the Node one. `server.mjs` is one implementation, not the
implementation.
