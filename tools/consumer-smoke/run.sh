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
for PKG in qdcore qddebug qdadm qdadm-mcp; do
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
  // Sibling packages count (#1895): they are published separately but land in
  // the SAME vite.config.js, and a config does not load halfway. A gate that
  // only watches qdadm reports green while the consumer is blocked — the very
  // mistake the typecheck-only gate made, one level up.
  await import('@quazardous/qdadm-mcp')
  await import('@quazardous/qdadm-mcp/connector')
  console.log('[consumer-smoke]   node entry points import cleanly')
"

# Apps import '@quazardous/qdadm/styles' without installing sass (#2260): the export must resolve to the
# compiled stylesheet, and the tarball must carry it. A pack that skipped the build would ship a dead import.
echo "[consumer-smoke] resolving the compiled stylesheet..."
node --input-type=module -e "
  import { createRequire } from 'node:module'
  import { statSync } from 'node:fs'
  const file = createRequire(process.cwd() + '/').resolve('@quazardous/qdadm/styles')
  if (!file.endsWith('dist/styles/qdadm.css')) {
    throw new Error('@quazardous/qdadm/styles resolves to ' + file + ', not the compiled stylesheet')
  }
  const size = statSync(file).size
  if (size < 10000) throw new Error('the compiled stylesheet is suspiciously small: ' + size + ' bytes')
  console.log('[consumer-smoke]   @quazardous/qdadm/styles →', file.split('node_modules/')[1], '(' + size + ' bytes)')
"

# The blocker exactly as the consumer meets it: vite RESOLVING a config that
# imports the plugin. This is the operation that failed — `npm run dev` and
# `npm run build` both die here, on an error that never names qdadm.
echo "[consumer-smoke] loading a vite config that uses the plugin..."
cat > vite.smoke.config.js <<'SMOKE_CONFIG'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'
export default { plugins: [qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()] }
SMOKE_CONFIG
node --input-type=module -e "
  const { loadConfigFromFile } = await import('vite')
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    './vite.smoke.config.js'
  )
  const plugins = loaded?.config?.plugins ?? []
  if (plugins.length < 3) {
    throw new Error('config loaded but the qdadm plugins are missing')
  }
  // The kernel checks this define to tell an app it forgot the plugin (#2259): if the plugin stopped setting
  // it, every correctly configured app would be told otherwise.
  const qdadm = plugins.find((p) => p && p.name === 'qdadm')
  const applied = typeof qdadm?.config === 'function' ? qdadm.config({}) : null
  if (applied?.define?.__QDADM_VITE_PLUGIN__ !== 'true') {
    throw new Error('qdadmVitePlugin() no longer defines __QDADM_VITE_PLUGIN__')
  }
  console.log('[consumer-smoke]   vite resolved the config with', plugins.length, 'qdadm plugins')
"

# A real production build, with no sass installed (#4140). Typechecking and
# loading the config both passed while every app's `vite build` died on a
# module that lazy-loaded a .scss file. Only a build walks the dynamic imports.
echo "[consumer-smoke] vite build of an app, without sass..."
node --input-type=module -e "
  import { createRequire } from 'node:module'
  const req = createRequire(process.cwd() + '/')
  for (const name of ['sass', 'sass-embedded']) {
    let found = null
    try { found = req.resolve(name) } catch {}
    if (found) throw new Error(name + ' is installed in the fixture: the build would not prove an app can do without it')
  }
"
mkdir -p build-app
cat > build-app/index.html <<'SMOKE_HTML'
<!doctype html>
<html><head><meta charset="utf-8"></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>
SMOKE_HTML
cat > build-app/main.js <<'SMOKE_MAIN'
// What an app pulls in: the kernel (which injects NotificationModule), the
// debug bar module, and the stylesheet. The build follows their lazy imports.
import { Kernel } from '@quazardous/qdadm'
import { DebugModule } from '@quazardous/qdadm/modules/debug'
import '@quazardous/qdadm/styles'
console.log(Kernel, DebugModule)
SMOKE_MAIN
cat > vite.build.config.js <<'SMOKE_BUILD'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
export default { root: 'build-app', logLevel: 'warn', plugins: [vue(), qdadmVitePlugin()], build: { outDir: 'dist', emptyOutDir: true } }
SMOKE_BUILD
npx vite build --config vite.build.config.js
ls build-app/dist/assets/*.css >/dev/null || { echo "[consumer-smoke] the build emitted no CSS" >&2; exit 1; }
echo "[consumer-smoke]   built: $(ls build-app/dist/assets | wc -l) assets, no sass needed"

echo "[consumer-smoke] OK — the packed tarball typechecks, loads AND builds as a strict consumer"
