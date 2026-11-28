/**
 * Log rules for the schema builder's demo (#5587): a YAML document with two
 * lists, `preprocess` and `rules`, and the JSON Schema that describes it. The
 * schema carries the structure and generic x-… annotations; the page brings
 * one handler of its own (`x-widget: regex`).
 */
import { YamlConflictError } from '@quazardous/qdadm/editors/yaml'

const KEY = 'qdadm-demo-log-rules'

const INITIAL = `# Log rules: the preprocessing normalizes a line, the rules route it.

preprocess:
  # an sftp refusal, whichever script tried
  - name: sftp refusé
    when: { channel: supplier.sftp }
    match: 'connexion sftp refusée(?: : (?P<script>\\S+))?'
    message: 'connexion sftp refusée (compte ou mot de passe)'
    extract: { supplier: '{script|dir}' } # who failed
    split: true
rules:
  - name: prix d'achat invalide
    when: { all: [ { channel: supplier.price }, { kind: warning } ] }
    then: { route: purchases.b2b, show: [id_product] }
`

export const SCHEMA = {
  type: 'object',
  properties: {
    preprocess: {
      title: 'Preprocessing',
      type: 'array',
      items: {
        type: 'object',
        'x-title': 'name',
        'x-enabled': 'enabled',
        required: ['name', 'match'],
        properties: {
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          when: { title: 'When', $ref: '#/$defs/when' },
          match: { type: 'string', title: 'Matches', description: 'A regular expression; named groups feed the targets', 'x-widget': 'regex' },
          message: { type: 'string', title: 'Normalized message' },
          extract: {
            type: 'object',
            title: 'Targets',
            propertyNames: { enum: ['supplier', 'host', 'product'] },
            'x-enumLabels': { supplier: 'Supplier', host: 'Host', product: 'Product' },
            additionalProperties: { type: 'string', examples: ['{script|dir}', '{host}', '{script}'] },
          },
          split: { type: 'boolean', title: 'One line per match' },
        },
      },
    },
    rules: {
      title: 'Rules',
      type: 'array',
      items: {
        type: 'object',
        'x-title': 'name',
        'x-enabled': 'enabled',
        properties: {
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          when: { title: 'When', $ref: '#/$defs/when' },
          then: {
            type: 'object',
            title: 'Then',
            properties: {
              route: { type: 'string', title: 'Route', examples: ['it', 'purchases.b2b', 'finance.payments'] },
              severity: { title: 'Severity', enum: ['info', 'warning', 'critical'], 'x-enumLabels': { info: 'Info', warning: 'Warning', critical: 'Critical' } },
              show: { type: 'array', title: 'Columns shown', items: { type: 'string', examples: ['id_product', 'id_supplier'] } },
            },
          },
        },
      },
    },
  },
  $defs: {
    when: { 'x-widget': 'conditions', oneOf: [{ $ref: '#/$defs/condition' }, { $ref: '#/$defs/group' }] },
    group: {
      oneOf: [
        { type: 'object', required: ['all'], properties: { all: { type: 'array', items: { $ref: '#/$defs/when' } } } },
        { type: 'object', required: ['any'], properties: { any: { type: 'array', items: { $ref: '#/$defs/when' } } } },
      ],
    },
    condition: {
      oneOf: [
        { title: 'Channel', type: 'object', required: ['channel'], properties: { channel: { type: 'string', examples: ['supplier.sftp', 'supplier.price', 'market.amazon', 'supplier.*'] } } },
        { title: 'Kind', type: 'object', required: ['kind'], properties: { kind: { enum: ['info', 'warning', 'error'] } } },
      ],
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
  return { yaml: INITIAL, revision: 1, history: [{ revision: 1, author: 'admin', date: new Date().toISOString(), reason: 'Initial rules', after: INITIAL }] }
}
const write = (state) => localStorage.setItem(KEY, JSON.stringify(state))
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))

export const fakeLogRulesAdapter = {
  async load() {
    await delay()
    const { yaml, revision } = read()
    return { yaml, revision, schema: SCHEMA }
  },
  async save({ yaml, reason, revision }) {
    await delay()
    const state = read()
    if (revision !== state.revision) throw new YamlConflictError({ yaml: state.yaml, revision: state.revision })
    const next = state.revision + 1
    state.history.unshift({ revision: next, author: 'admin', date: new Date().toISOString(), reason, before: state.yaml, after: yaml })
    write({ ...state, yaml, revision: next })
    return { revision: next }
  },
  async history() {
    await delay()
    return read().history
  },
}

export function resetLogRules() {
  localStorage.removeItem(KEY)
}
