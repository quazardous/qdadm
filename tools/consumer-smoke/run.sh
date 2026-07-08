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

echo "[consumer-smoke] OK — the packed tarball typechecks as a strict consumer"
