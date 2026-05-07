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

## Cutting a release — automated (GitHub Actions, default path)

`.github/workflows/release.yml` runs `changesets/action@v1` on every push to `main`.

```
PR with .changeset/*.md ─ merged ─► Action runs
                                      │
                                      ▼
                  ┌──── pending changesets exist? ────┐
                  │ yes                            no │
                  ▼                                   ▼
       Opens / updates a            Versions ahead of the npm
       "chore(release): version     registry → publishes each
       packages" PR. Commits         affected package, in
       version bumps + lockfile      topological order, with
       refresh + CHANGELOG entries.  npm provenance. Pushes git
       Wait for review + merge.     tags `<pkg>@<version>`.
```

So the human flow is:

1. Open a PR with your code change + a `.changeset/*.md`. Merge.
2. Action opens a "Version Packages" PR. Review the diff (versions, CHANGELOG, lockfile).
3. Merge that PR. Action publishes everything to npm, creates tags, done.

You never run `npm publish` locally.

### One-time setup

The Action expects an **`NPM_TOKEN`** repository secret:

1. On npmjs.com → *Account settings → Access tokens → Generate New Token → Automation* (Automation tokens bypass 2FA, which is required for CI).
2. On GitHub → *Repo settings → Secrets and variables → Actions → New repository secret* → name `NPM_TOKEN`, paste the token.

`GITHUB_TOKEN` is auto-provided by Actions. The workflow's `permissions:` block grants it `contents: write` (to commit the Version PR + push tags), `pull-requests: write` (to open the PR), and `id-token: write` (for npm provenance attestation).

## Cutting a release — manual (escape hatch)

If GitHub is down, NPM_TOKEN is rotating, or you want to verify a release dry locally:

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
