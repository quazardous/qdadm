/**
 * Routing rules for the rule builder's demo (#5581): a YAML document with
 * comments, kept in localStorage like the YAML config page's, its vocabulary,
 * and a trial that says which rule each sample event would take.
 */
import { YamlConflictError } from '@quazardous/qdadm/editors/yaml'
import { parseYaml } from '@quazardous/vanilla-yamleditor'

const KEY = 'qdadm-demo-routing-rules'

const INITIAL = `# Routing rules: the first rule that matches routes the event.

# les achats B2B : le prix fournisseur, pas l'IT
- name: prix d'achat invalide
  when:
    all:
      - channel: supplier.price
      - any:
          - measure: { refused: ">= 1000" }
          - measure: { refused_ratio: ">= 20%" } # the share of prices refused
  then:
    route: purchases.b2b
    severity: critical

# the rest of the warnings goes to IT
- name: app warnings
  when:
    all:
      - channel: app.warning
  then:
    route: it
    severity: info
`

export const VOCABULARY = {
  conditions: {
    channel: {
      label: 'Channel',
      param: { type: 'enum', options: [{ value: 'supplier.price', label: 'Supplier price' }, { value: 'app.warning', label: 'App warning' }, { value: 'payment.failed', label: 'Payment failed' }] },
    },
    measure: {
      label: 'Measure',
      param: { type: 'keyedThreshold', keys: [{ value: 'refused', label: 'Refused' }, { value: 'refused_ratio', label: 'Refused (%)', unit: '%' }, { value: 'latency_ms', label: 'Latency (ms)' }] },
    },
    level: { label: 'Level at least', param: { type: 'threshold' } },
  },
  actions: {
    route: { label: 'Route', param: { type: 'text', placeholder: 'team.queue', suggestions: ['it', 'purchases.b2b', { value: 'finance.payments', label: 'Finance — payments' }] } },
    severity: { label: 'Severity', param: { type: 'enum', options: [{ value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'critical', label: 'Critical' }] } },
    notify: { label: 'Notify', param: { type: 'boolean' } },
  },
}

/** Sample events for the live trial */
export const SAMPLES = [
  { id: 1, channel: 'supplier.price', refused: 1500, refused_ratio: 5, level: 3 },
  { id: 2, channel: 'supplier.price', refused: 40, refused_ratio: 32, level: 2 },
  { id: 3, channel: 'supplier.price', refused: 10, refused_ratio: 2, level: 1 },
  { id: 4, channel: 'app.warning', level: 2, latency_ms: 900 },
  { id: 5, channel: 'payment.failed', level: 4 },
]

const OPS = { '>=': (a, b) => a >= b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '<': (a, b) => a < b, '=': (a, b) => a === b }
const passes = (actual, threshold) => {
  const m = /^\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)\s*%?\s*$/.exec(String(threshold))
  return !!m && typeof actual === 'number' && OPS[m[1]](actual, Number(m[2]))
}
function matches(cond, event) {
  const [key, value] = Object.entries(cond ?? {})[0] ?? []
  if (key === 'all') return (value ?? []).every((c) => matches(c, event))
  if (key === 'any') return (value ?? []).some((c) => matches(c, event))
  if (key === 'channel') return event.channel === value
  if (key === 'measure') {
    const [m, t] = Object.entries(value ?? {})[0] ?? []
    return passes(event[m], t)
  }
  if (key === 'level') return passes(event.level, value)
  return false
}

/** The trial: for each sample, the first enabled rule that matches, or none */
export function trial(yaml) {
  const { value, errors } = parseYaml(yaml)
  if (errors.length || !Array.isArray(value)) return null
  return SAMPLES.map((event) => {
    const rule = value.find((r) => r && r.enabled !== false && matches(r.when, event))
    return { event, rule: rule ? rule.name : null, route: rule?.then?.route ?? null }
  })
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

export const fakeRulesAdapter = {
  async load() {
    await delay()
    const { yaml, revision } = read()
    return { yaml, revision }
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

export function resetRoutingRules() {
  localStorage.removeItem(KEY)
}
