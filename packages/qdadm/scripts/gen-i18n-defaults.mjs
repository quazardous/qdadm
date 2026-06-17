/**
 * Generates `core.<locale>.generated.ts` from each `core.<locale>.yml` in
 * src/i18n/defaults/. The generated module exports the raw YAML text as a
 * default string, so the i18n loader receives the same `{ default: string }`
 * shape it used to get from a Vite `?raw` import — minus the Vite-specific
 * binding that broke consumers in file:/symlink setups (qdadm #492).
 *
 * The `.yml` files stay the editable, translator-friendly source of truth.
 * The `.generated.ts` files are committed so the package keeps shipping
 * source-only (no build step at publish). Run after editing any `.yml`:
 *
 *   npm run gen:i18n-defaults -w packages/qdadm
 *
 * A test (defaults/__tests__/generated-sync.test.ts) fails if they drift.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const defaultsDir = join(here, '..', 'src', 'i18n', 'defaults')

const YAML_RE = /^core\.([a-z-]+)\.yml$/

/** Escape a raw string so it is safe inside a template literal. */
export function toTemplateLiteral(raw) {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

/** Build the `.generated.ts` source for one YAML file. */
export function renderModule(yamlFileName, raw) {
  return (
    `/* GENERATED from ${yamlFileName} — DO NOT EDIT.\n` +
    ` * Run \`npm run gen:i18n-defaults -w packages/qdadm\` to regenerate. */\n` +
    `export default \`${toTemplateLiteral(raw)}\`\n`
  )
}

function main() {
  const ymlFiles = readdirSync(defaultsDir).filter((f) => YAML_RE.test(f))
  if (ymlFiles.length === 0) {
    throw new Error(`No core.<locale>.yml files found in ${defaultsDir}`)
  }
  for (const file of ymlFiles) {
    const locale = file.match(YAML_RE)[1]
    const raw = readFileSync(join(defaultsDir, file), 'utf8')
    const target = join(defaultsDir, `core.${locale}.generated.ts`)
    writeFileSync(target, renderModule(file, raw), 'utf8')
    console.log(`generated core.${locale}.generated.ts (${raw.length} bytes)`)
  }
}

// Only run when invoked directly, so the test can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
