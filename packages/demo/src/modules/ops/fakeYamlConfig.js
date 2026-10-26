/**
 * A fake configuration server for the YAML config page (#4303): the
 * document, its revision and its history live in localStorage, so saves and
 * history survive a reload. "Someone else saves" bumps the revision behind
 * the editor's back, to see the conflict.
 */
import { YamlConflictError } from '@quazardous/qdadm/editors/yaml'
import { parseYaml, setValue } from '@quazardous/vanilla-yamleditor'

const KEY = 'qdadm-demo-yaml-config'

const INITIAL = `# Availability filters, by store.
# Edited live by the ops team: every save is reviewed and kept in the history.
filters:
  # Paris: the flagship
  paris:
    enabled: true   # live since March
    min_stock: 3
    channel: web
    tags: [summer, outlet]

  lyon:
    enabled: false
    min_stock: 1
    channel: store
    skus:
    - A1
    - "B2"
`

export const SCHEMA = {
  type: 'object',
  properties: {
    filters: {
      title: 'Filters',
      description: 'One entry per store',
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean', title: 'Enabled' },
          min_stock: { type: 'integer', title: 'Minimum stock', minimum: 0, maximum: 1000, description: 'Units kept back from sale' },
          channel: { enum: ['web', 'store', 'both'], title: 'Channel' },
          tags: { type: 'array', title: 'Tags', items: { type: 'string', minLength: 2 } },
          skus: { type: 'array', title: 'SKUs', items: { type: 'string', pattern: '^[A-Z][0-9]+$' } },
        },
        additionalProperties: false,
      },
    },
  },
}

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY))
    if (stored?.yaml) return stored
  } catch {
    // Start over
  }
  return { yaml: INITIAL, revision: 1, history: [{ revision: 1, author: 'admin', date: new Date().toISOString(), reason: 'Initial filters', after: INITIAL }] }
}

const write = (state) => localStorage.setItem(KEY, JSON.stringify(state))
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

function commit(state, yaml, reason, author) {
  const revision = state.revision + 1
  state.history.unshift({ revision, author, date: new Date().toISOString(), reason, before: state.yaml, after: yaml })
  write({ ...state, yaml, revision })
  return revision
}

export const fakeYamlAdapter = {
  async load() {
    await delay()
    const { yaml, revision } = read()
    return { yaml, revision, schema: SCHEMA }
  },
  /** What a server would add on top of the schema: a rule across fields. */
  async check(yaml) {
    await delay()
    const { value, errors } = parseYaml(yaml)
    if (errors.length) return [{ path: [], message: errors[0].message }]
    const problems = []
    for (const [store, conf] of Object.entries(value?.filters ?? {})) {
      if (conf?.channel === 'store' && conf?.enabled && !conf?.skus?.length) {
        problems.push({ path: `filters.${store}.skus`, message: 'A store channel needs at least one SKU' })
      }
    }
    return problems
  },
  async save({ yaml, reason, revision }) {
    await delay()
    const state = read()
    if (revision !== state.revision) throw new YamlConflictError({ yaml: state.yaml, revision: state.revision, schema: SCHEMA })
    return { revision: commit(state, yaml, reason, 'admin') }
  },
  async history() {
    await delay()
    return read().history
  },
}

/** Someone else saves meanwhile: Lyon's minimum stock goes up. */
export function someoneElseSaves() {
  const state = read()
  const current = parseYaml(state.yaml).value?.filters?.lyon?.min_stock ?? 0
  commit(state, setValue(state.yaml, ['filters', 'lyon', 'min_stock'], current + 5), 'Lyon restock (bob)', 'bob')
}

export function resetYamlConfig() {
  localStorage.removeItem(KEY)
}
