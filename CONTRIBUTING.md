# Contributing to qdadm

Thanks for looking at qdadm. This file covers the mechanics: setup, the gates a
change has to pass, and how a release goes out. Everything else — how the code
is organised, what the conventions are — lives in `docs/` and is linked from
here rather than duplicated.

## The repo

A npm-workspaces monorepo. Three packages publish to npm:

| Package | What it is |
|---|---|
| [`@quazardous/qdadm`](packages/qdadm) | The framework itself |
| [`@quazardous/qdcore`](packages/qdcore) | Framework-agnostic primitives (signals, hooks, navigation stack, SSE) |
| [`@quazardous/qddebug`](packages/qddebug) | Debug bridge, collectors, debug bar |

`packages/demo`, `packages/qdadm-mcp`, and everything under `examples/` are not
part of that train — see [RELEASING.md](RELEASING.md) for which are private.

## Setup

```sh
npm install          # from the repo root — installs every workspace
npm run dev          # demo app on http://localhost:5174
```

The demo is the main playground: it exercises most of the framework and is what
you'll usually reach for to see a change in a real app.

## Finding your way

Read these before a first non-trivial change:

| You want | Read |
|---|---|
| Where a given thing lives in the source | [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md) — the code index |
| Why the framework is shaped this way | [`docs/QDADM_CREDO.md`](docs/QDADM_CREDO.md), [`docs/architecture.md`](docs/architecture.md) |
| The reasoning behind a structural decision | [`docs/adr/`](docs/adr/) |
| What you may change without breaking consumers | [`docs/API_STABILITY.md`](docs/API_STABILITY.md) |
| To drive a running app from an agent | [`AGENTS.md`](AGENTS.md) |

## Quality gates

Four gates run on every push to `main` (in
[`.github/workflows/release.yml`](.github/workflows/release.yml), ahead of any
publish). There is no separate PR check — run them locally before you push:

```sh
npm test                                          # vitest, every workspace
npm run type-check                                # vue-tsc --noEmit, every workspace
npm run build:types --workspace=@quazardous/qdadm # declarations must emit cleanly
npm run smoke:consumer                            # packed tarball vs. a strict consumer
```

The last one matters more than it looks. qdadm ships **raw TypeScript and
`.vue` sources** — no build step, no `dist/`. Anything that doesn't compile
lands directly in a consumer's `vue-tsc` run, and Vite's dev server won't warn
you because it strips types without checking them. So `smoke:consumer` packs
the real tarball (`npm pack`), installs it into a pristine strict-TS fixture,
and typechecks it. Installing the tarball rather than linking the workspace
also validates the `exports` map and the `files` whitelist — the
forgot-to-ship-a-file breakage no symlink can catch.

That fixture (`tools/consumer-smoke/fixture/`) is also the stable-API contract.
See [`docs/API_STABILITY.md`](docs/API_STABILITY.md) before changing a public
signature: what the fixture exercises is stable and needs a major to break;
what carries `@experimental` may move in a minor.

## Making a change

1. Work on `main` for small changes; branch for substantial ones.
2. Add tests next to the existing ones (`packages/qdadm/tests/`, mirroring the
   source tree).
3. Run the four gates above.
4. **Add a changeset** if you touched a published package:
   ```sh
   npm run changeset
   ```
   Pick the affected packages and a bump level — `minor` for anything additive,
   `patch` for bugfixes only. Commit it alongside your change. A change with no
   user-visible effect on a published package (docs, demo, tooling) doesn't
   need one.

Commit messages follow `type(scope): summary` with the ticket number when there
is one, e.g. `feat(list): per-entity punchline (#1439)`.

### Recipes

| Task | Where it's documented |
|---|---|
| Add an entity / module | [`docs/tutorial-mini-admin.md`](docs/tutorial-mini-admin.md) step 2 |
| Add a storage adapter | [`docs/extension.md`](docs/extension.md) |
| Add a CRUD page | [`docs/crud.md`](docs/crud.md), [`docs/page-compositions.md`](docs/page-compositions.md) |
| Add a field widget | [`docs/forms.md`](docs/forms.md) |
| Add a debug collector | [`AGENTS.md`](AGENTS.md#adding-a-custom-collector) |

## Releasing

Versioning and publishing run through Changesets; the full flow — including the
version-locally-then-push rule and the OIDC publish setup — is in
[RELEASING.md](RELEASING.md). Short version: land your change with a changeset,
then `npm run release:version`, commit, push. CI publishes. You never run
`npm publish` yourself.

## Documentation policies

- **Current state only.** Docs describe how things work *now* — no
  version-gated caveats, no "since 1.18" notes, no dated gotchas. History
  belongs in the CHANGELOG.
- **Lean README.** The root README is an entry point, not a manual: one line
  and one link per topic, substance in a dedicated `docs/` file.
- **English** for everything public-facing: code, comments, docs, commits.
