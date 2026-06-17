# Releasing

Versioning + npm publishing for the qdadm-monorepo runs through [Changesets](https://github.com/changesets/changesets). Three packages ship to npm:

- `@quazardous/qdadm`
- `@quazardous/qdcore`
- `@quazardous/qddebug`

`qdadm-demo`, `@qdadm/hello-world`, and `qdadm-hello-world` are private examples — they're explicitly ignored in `.changeset/config.json` and never get auto-bumped or published.

## Day-to-day flow

1. **Make your change** in any package.
2. **Add a changeset** describing what changed and which packages are affected:
   ```sh
   npm run changeset
   ```
   This drops a markdown file in `.changeset/`. Pick the bumped packages (use space + arrows in the prompt), choose `patch` / `minor` / `major`, and write a one-paragraph user-facing summary. Commit the changeset alongside your code change.
3. **(optional)** Check what's pending:
   ```sh
   npm run release:status
   ```

You can stack multiple changesets across multiple commits — they accumulate until you're ready to release.

## Cutting a release — default path (version locally, Action publishes)

`.github/workflows/release.yml` runs `changesets/action@v1` on every push to `main`. The Action has two modes, decided by whether pending `.changeset/*.md` files exist at push time:

- **Pending changesets exist** → it tries to open a "Version Packages" PR. **This repo does not use that mode** — GitHub Actions is not permitted to create PRs here (the step fails with *"GitHub Actions is not permitted to create or approve pull requests"*). So we consume changesets locally instead (see below).
- **No pending changesets, local version ahead of npm** → it publishes each affected package in topological order, with npm provenance, and pushes git tags `<pkg>@<version>`. **This is the mode we use.**

So the human flow is:

1. Land your code change + a `.changeset/*.md` on `main` (direct push or merged PR).
2. **Version locally** — this consumes the changesets so the next push hits the publish mode, not the PR mode:
   ```sh
   npm run release:version          # bumps versions + CHANGELOG + lockfile, deletes the consumed .changeset/*.md
   git add -A && git commit -m "chore(release): <pkg> <version> — <summary>"
   git push                         # local version is now ahead of npm
   ```
3. The push triggers `release.yml`, which sees no pending changesets + a version ahead of the registry → publishes to npm via OIDC and pushes the git tag. You never run `npm publish` yourself.

> Why not the auto-PR? The "Version Packages" PR mode needs Actions to open a PR, which is disabled on this repo (and we prefer working directly on `main`). Consuming changesets locally in step 2 sidesteps it entirely. To switch to the PR flow instead, enable *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests* and skip step 2.

### One-time setup — OIDC Trusted Publishers (no token)

Publish auth uses **npm OIDC Trusted Publishers**, not a long-lived token. There is no `NPM_TOKEN` secret to manage or rotate.

1. On npmjs.com, for **each** published package (`@quazardous/qdadm`, `@quazardous/qdcore`, `@quazardous/qddebug`) → *package page → Settings → Trusted Publisher → Add*:
   - Provider: **GitHub Actions**
   - Organization or user: `quazardous`
   - Repository: `qdadm`
   - Workflow filename: `release.yml`
   - Environment: *(leave empty)*
   - Allowed actions: **npm publish** (+ optionally **npm stage publish**)
2. Nothing to add on the GitHub side. The runner exchanges its GitHub OIDC token for a short-lived npm token per run.

`GITHUB_TOKEN` is auto-provided. The workflow's `permissions:` block grants `contents: write` (commit + push tags) and `id-token: write` (powers both npm provenance attestation **and** the OIDC publish handshake).

> **Runner npm version matters.** OIDC Trusted Publishing needs npm ≥ 11.5.1, but Node 22 LTS ships npm 10.x — so `release.yml` runs `npm install -g npm@latest` before publishing. Without it, publish requests reach the registry with no auth and fail as an opaque `E404`. If you ever see `E404 Not Found - PUT .../@quazardous%2f…` on a package that already exists, check the runner's npm version first.

## Cutting a release — manual (escape hatch)

If GitHub Actions is down, or you want to publish from your machine (requires `npm login` as a `@quazardous` maintainer — the OIDC path only works inside the Action):

```sh
npm run release:version    # consumes .changeset/*.md → bumps versions, updates per-package CHANGELOG.md, refreshes lockfile
git diff                   # review the bumps and CHANGELOG entries
git add -A && git commit -m "chore(release): version packages"
npm run release:publish    # runs all workspace tests, then npm publish in topological order
git push --follow-tags
```

`release:publish` only publishes packages that have a version increment that npm hasn't seen yet — re-runs are idempotent.

### What `release:version` does for you

- Consumes every `.changeset/*.md` since the last release.
- Bumps `version` in each affected `package.json` according to the highest declared bump.
- **Re-pins internal deps** (`updateInternalDependencies: "patch"` in config). Example: if `@quazardous/qdcore` goes `0.2.1 → 0.3.0`, then `qdadm`'s `dependencies."@quazardous/qdcore"` is rewritten to `^0.3.0` and qdadm itself gets a patch bump. This is the guard against the `"*"` mistake that fossilized prod for skybot pre-1.19.2.
- Generates / updates each package's `CHANGELOG.md`.
- Refreshes the root `package-lock.json` (the script chains `npm install --package-lock-only` after `changeset version`).

### What `release:publish` does for you

- Runs `npm test --workspaces` first — refuses to publish a broken tree.
- Calls `changeset publish` which:
  - Reads each `package.json` `version` field.
  - Compares against the npm registry.
  - For every package with a not-yet-published version, runs `npm publish --access public` (all three packages live under the `@quazardous` scope).
  - Skips `private: true` packages and packages listed in `.changeset/config.json#ignore`.
  - Creates git tags `<package>@<version>`.

## Manual release (without Changesets)

Don't. The `"*"` deps incident from before 1.19.2 happened because internal pin sync was manual. If you need an emergency hotfix, still write a changeset for it — even a one-liner is fine.

## Pre-release / snapshot

For testing a not-yet-stable change against a downstream consumer:

```sh
npx changeset pre enter next         # enters pre-release mode tagged "next"
npm run changeset                    # add changesets as usual
npm run release:version              # bumps to e.g. 1.20.0-next.0
npm run release:publish              # publishes with --tag next
# ...iterate...
npx changeset pre exit               # back to normal
```

Consumers can then `npm install @quazardous/qdadm@next` without polluting the `latest` tag.

## Scope ownership

The `@quazardous` scope is owned by the `quazardous` npm account. Confirm with `npm whoami` before publishing. The previously-unscoped `qdadm` package on npm has been deprecated in favor of `@quazardous/qdadm` from 1.19.3 onwards — see `npm view qdadm` for the deprecation notice that points at the new name.

## What lives outside Changesets

- The root monorepo `package.json` `version` field is decorative — Changesets ignores private packages.
- Demo bumps (`qdadm-demo` 0.22.0 → 0.23.0, etc.) follow their own commit cadence (`chore(demo): …`), not Changesets.
- `examples/hello-world` is a sandbox, never tagged.
