#!/usr/bin/env bash
# Consumer smoke test (#1024).
#
# Packs @quazardous/qdadm (`npm pack` — the EXACT artifact a release would
# publish), installs the tarball into a pristine copy of the strict-TS
# fixture app, and runs vue-tsc. Installing the tarball rather than a
# workspace link also validates the `exports` map and `files` whitelist —
# the forgot-to-ship-a-file class of breakage no symlink can catch.
#
# Usage: bash tools/consumer-smoke/run.sh   (from anywhere in the repo)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_DIR="$ROOT/tools/consumer-smoke/fixture"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# Pack the whole publishable train (qdadm + its in-repo satellites) so a
# release that bumps internal dependency ranges to not-yet-published versions
# can still be smoke-tested: qdadm's deps resolve against the sibling
# tarballs instead of requiring them on the registry first.
echo "[consumer-smoke] packing the workspace train..."
TARBALLS=()
for PKG in qdcore qddebug qdadm; do
  TARBALL="$(cd "$ROOT/packages/$PKG" && npm pack --silent --pack-destination "$WORKDIR" | tail -1)"
  echo "[consumer-smoke]   $TARBALL"
  TARBALLS+=("$WORKDIR/$TARBALL")
done

cp -r "$FIXTURE_DIR" "$WORKDIR/app"
cd "$WORKDIR/app"

echo "[consumer-smoke] installing fixture toolchain (locked)..."
npm ci --no-audit --no-fund --loglevel=error

echo "[consumer-smoke] installing the packed tarballs..."
npm install --no-audit --no-fund --loglevel=error "${TARBALLS[@]}"

echo "[consumer-smoke] vue-tsc against the tarball..."
npx vue-tsc --noEmit -p tsconfig.json

# Typechecking proves the package COMPILES. It does not prove Node can LOAD it
# (#1895): Node refuses to strip types under node_modules, so an entry point
# published as raw .ts is importable from a workspace symlink — whose realpath
# escapes node_modules — and dead from a real install. That is exactly the gap
# this gate missed, on an entry the fixture already typechecked.
echo "[consumer-smoke] importing the Node entry points for real..."
node --input-type=module -e "
  await import('@quazardous/qdadm/vite')
  await import('@quazardous/qdadm/vite-plugin-debug')
  await import('@quazardous/qdadm/gen/vite-plugin')
  console.log('[consumer-smoke]   node entry points import cleanly')
"

# The blocker exactly as the consumer meets it: vite RESOLVING a config that
# imports the plugin. This is the operation that failed — `npm run dev` and
# `npm run build` both die here, on an error that never names qdadm.
echo "[consumer-smoke] loading a vite config that uses the plugin..."
cat > vite.smoke.config.js <<'SMOKE_CONFIG'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
export default { plugins: [qdadmVitePlugin(), qdadmDebugPlugin()] }
SMOKE_CONFIG
node --input-type=module -e "
  const { loadConfigFromFile } = await import('vite')
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    './vite.smoke.config.js'
  )
  const plugins = loaded?.config?.plugins ?? []
  if (plugins.length < 2) {
    throw new Error('config loaded but the qdadm plugins are missing')
  }
  console.log('[consumer-smoke]   vite resolved the config with', plugins.length, 'qdadm plugins')
"

echo "[consumer-smoke] OK — the packed tarball typechecks AND loads as a strict consumer"
