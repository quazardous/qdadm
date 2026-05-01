<script setup lang="ts">
/**
 * I18nPanel - Debug panel for the i18n subsystem.
 *
 * Sections:
 *  - Header: active locale, available locales, strategy, providers
 *  - Resolve: live resolve() against any key with full trace
 *  - Missing: keys captured via i18n:missing (deduped by key+locale, with counts)
 *  - Coverage: entity × locale matrix with per-cell drill-down
 *  - Bundle: dump of the merged inline bundle for a chosen locale
 */
import { ref, computed, inject, watch, onMounted } from 'vue'
import { ObjectTree } from '@quazardous/qddebug'
import type { I18n } from '../../../../i18n/I18n'
import type { ResolveTrace } from '../../../../i18n/types'
import type { I18nCollector, MissingKeyEntry } from '../../I18nCollector'
import type { Orchestrator } from '../../../../orchestrator/Orchestrator'

interface SignalsBus {
  emit: (signal: string, data?: unknown) => void | Promise<void>
}

const props = defineProps<{
  collector: I18nCollector
  entries: MissingKeyEntry[]
}>()

const i18n = inject<I18n | null>('qdadmI18n', null)
const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
const signals = inject<SignalsBus | null>('qdadmSignals', null)

type Section = 'header' | 'resolve' | 'missing' | 'coverage' | 'bundle'
const activeSection = ref<Section>('missing')

// ─── Header ───────────────────────────────────────────────────────────────
const currentLocale = computed<string>(() => i18n?.locale.value ?? 'en')
const availableLocales = ref<string[]>([])

async function refreshAvailableLocales() {
  if (!i18n) {
    availableLocales.value = []
    return
  }
  availableLocales.value = await i18n.availableLocales()
  // Always include the active locale even if no provider declares it
  if (!availableLocales.value.includes(currentLocale.value)) {
    availableLocales.value = [currentLocale.value, ...availableLocales.value]
  }
}
onMounted(refreshAvailableLocales)
watch(currentLocale, refreshAvailableLocales)

function switchLocale(locale: string) {
  if (signals) {
    void signals.emit('locale:change', locale)
  } else if (i18n) {
    void i18n.changeLocale(locale)
  }
}

// ─── Resolve tester ───────────────────────────────────────────────────────
const resolveKey = ref('')
const resolveLocale = ref<string>('')
watch(currentLocale, (loc) => {
  if (!resolveLocale.value) resolveLocale.value = loc
}, { immediate: true })

const resolveTrace = computed<ResolveTrace | null>(() => {
  if (!i18n || !resolveKey.value) return null
  // Temporarily resolve against the chosen locale (without switching globally)
  // by re-calling resolve via a small helper — kernel.i18n.resolve uses the
  // active locale, so we mutate the instance's locale ref briefly only for
  // resolve(), restore it. This is read-only though; safer to just call
  // resolve which uses locale.value, so we surface the trace for the active
  // locale and let the user switch via the dropdown.
  return i18n.resolve(resolveKey.value)
})

function copyResolveSnippet() {
  if (!resolveTrace.value) return
  const segs = resolveKey.value.split('.')
  const skeleton = buildNested(segs, '…')
  const snippet = `ctx.messages('${resolveLocale.value || currentLocale.value}', ${JSON.stringify(skeleton, null, 2)})`
  void navigator.clipboard?.writeText(snippet)
}

function buildNested(segments: string[], leaf: unknown): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let cursor: Record<string, unknown> = root
  segments.forEach((seg, i) => {
    if (i === segments.length - 1) {
      cursor[seg] = leaf
    } else {
      cursor[seg] = {}
      cursor = cursor[seg] as Record<string, unknown>
    }
  })
  return root
}

// ─── Missing keys ─────────────────────────────────────────────────────────
const missingFilter = ref('')
const missingGrouped = computed<Array<{ ns: string; entries: MissingKeyEntry[] }>>(() => {
  const filter = missingFilter.value.trim().toLowerCase()
  const filtered = filter
    ? props.entries.filter(
        (e) => e.key.toLowerCase().includes(filter) || e.locale.includes(filter)
      )
    : props.entries
  const groups: Record<string, MissingKeyEntry[]> = {}
  for (const e of filtered) {
    const ns = e.key.split('.')[0] ?? '_other'
    if (!groups[ns]) groups[ns] = []
    groups[ns]!.push(e)
  }
  return Object.entries(groups)
    .map(([ns, entries]) => ({ ns, entries: entries.sort((a, b) => a.key.localeCompare(b.key)) }))
    .sort((a, b) => a.ns.localeCompare(b.ns))
})

function copyMissingSkeleton() {
  const skeleton = props.collector.asJsonSkeleton()
  void navigator.clipboard?.writeText(JSON.stringify(skeleton, null, 2))
}

// ─── Coverage matrix ──────────────────────────────────────────────────────
interface CoverageCell {
  entity: string
  locale: string
  total: number
  hits: number
  status: 'green' | 'yellow' | 'red' | 'none'
}

interface CoverageDrill {
  entity: string
  locale: string
  fields: Array<{ name: string; key: string; hit: boolean; result: string }>
}

const coverageEntities = ref<string[]>([])
const drillCell = ref<CoverageDrill | null>(null)

function refreshCoverageEntities() {
  if (!orchestrator) {
    coverageEntities.value = []
    return
  }
  coverageEntities.value = orchestrator.getRegisteredNames?.() ?? []
}
onMounted(refreshCoverageEntities)

function getEntityFields(entity: string): string[] {
  const manager = orchestrator?.get?.(entity) as { fields?: Record<string, unknown> } | null
  return manager?.fields ? Object.keys(manager.fields) : []
}

const coverageMatrix = computed<CoverageCell[]>(() => {
  if (!i18n) return []
  // Re-read tick for reactivity (the I18n locale ref is the natural trigger)
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  currentLocale.value
  const cells: CoverageCell[] = []
  for (const entity of coverageEntities.value) {
    const fields = getEntityFields(entity)
    if (fields.length === 0) continue
    for (const locale of availableLocales.value) {
      const prevLocale = i18n.locale.value
      // Briefly point the resolver at the target locale to compute coverage,
      // then restore. We don't emit locale:changed so nothing else reacts.
      i18n.locale.value = locale
      let hits = 0
      for (const f of fields) {
        const trace = i18n.resolve(`entities.${entity}.fields.${f}`)
        if (trace.hit) hits++
      }
      i18n.locale.value = prevLocale
      const total = fields.length
      const ratio = total === 0 ? 0 : hits / total
      let status: CoverageCell['status'] = 'red'
      if (ratio === 1) status = 'green'
      else if (ratio >= 0.5) status = 'yellow'
      else if (hits > 0) status = 'red'
      else status = 'red'
      cells.push({ entity, locale, total, hits, status })
    }
  }
  return cells
})

const coverageByEntity = computed<Record<string, Record<string, CoverageCell>>>(() => {
  const out: Record<string, Record<string, CoverageCell>> = {}
  for (const cell of coverageMatrix.value) {
    if (!out[cell.entity]) out[cell.entity] = {}
    out[cell.entity]![cell.locale] = cell
  }
  return out
})

function drillDown(entity: string, locale: string) {
  if (!i18n) return
  const fields = getEntityFields(entity)
  const prevLocale = i18n.locale.value
  i18n.locale.value = locale
  const detail = fields.map((name) => {
    const key = `entities.${entity}.fields.${name}`
    const trace = i18n.resolve(key)
    return { name, key, hit: trace.hit, result: trace.result }
  })
  i18n.locale.value = prevLocale
  drillCell.value = { entity, locale, fields: detail }
}

// ─── Bundle inspector ─────────────────────────────────────────────────────
const bundleLocale = ref<string>('')
watch(currentLocale, (loc) => {
  if (!bundleLocale.value) bundleLocale.value = loc
}, { immediate: true })

const bundleData = computed<Record<string, unknown> | null>(() => {
  if (!i18n || !bundleLocale.value) return null
  return i18n.dump(bundleLocale.value) as Record<string, unknown>
})

function downloadBundle() {
  if (!bundleData.value) return
  const blob = new Blob([JSON.stringify(bundleData.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `qdadm-i18n-${bundleLocale.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}
</script>

<template>
  <div class="i18n-panel">
    <!-- Section tabs -->
    <div class="i18n-tabs">
      <button
        v-for="s in (['header','resolve','missing','coverage','bundle'] as Section[])"
        :key="s"
        class="i18n-tab"
        :class="{ 'i18n-tab-active': activeSection === s }"
        @click="activeSection = s"
      >
        {{ ({ header: 'State', resolve: 'Resolve', missing: 'Missing', coverage: 'Coverage', bundle: 'Bundle' })[s] }}
        <span v-if="s === 'missing' && entries.length" class="i18n-tab-count">{{ entries.length }}</span>
      </button>
    </div>

    <div v-if="!i18n" class="i18n-empty">
      <i class="pi pi-info-circle" />
      <span>No i18n subsystem on this kernel.</span>
    </div>

    <!-- ─── State ────────────────────────────────────────────────── -->
    <div v-else-if="activeSection === 'header'" class="i18n-section">
      <div class="i18n-row">
        <span class="i18n-row-label">Active locale</span>
        <select :value="currentLocale" class="i18n-select" @change="switchLocale(($event.target as HTMLSelectElement).value)">
          <option v-for="loc in availableLocales" :key="loc" :value="loc">{{ loc }}</option>
        </select>
      </div>
      <div class="i18n-row">
        <span class="i18n-row-label">Available</span>
        <span class="i18n-row-value">{{ availableLocales.join(', ') || '—' }}</span>
      </div>
      <div class="i18n-row">
        <span class="i18n-row-label">Locale switches</span>
        <span class="i18n-row-value">
          <span v-for="(c, idx) in collector.getLocaleHistory()" :key="idx" class="i18n-chip">
            {{ c.locale }} <small>{{ formatTime(c.at) }}</small>
          </span>
          <span v-if="collector.getLocaleHistory().length === 0" class="i18n-muted">none yet</span>
        </span>
      </div>
    </div>

    <!-- ─── Resolve tester ─────────────────────────────────────────── -->
    <div v-else-if="activeSection === 'resolve'" class="i18n-section">
      <div class="i18n-resolve-input">
        <input
          v-model="resolveKey"
          type="text"
          placeholder="entities.books.fields.title"
          class="i18n-key-input"
        />
        <button v-if="resolveTrace" class="debug-toolbar-btn" @click="copyResolveSnippet">
          <i class="pi pi-copy" /> Snippet
        </button>
      </div>
      <div v-if="resolveTrace" class="i18n-resolve-result">
        <div class="i18n-resolve-summary">
          <span class="i18n-resolve-value">"{{ resolveTrace.result }}"</span>
          <span class="i18n-chip" :class="{ 'i18n-chip-hit': resolveTrace.hit, 'i18n-chip-miss': !resolveTrace.hit }">
            {{ resolveTrace.hit ? 'hit' : 'miss' }}
          </span>
          <span class="i18n-muted">in {{ resolveTrace.locale }}</span>
        </div>
        <ol class="i18n-trace">
          <li v-for="(step, idx) in resolveTrace.steps" :key="idx" class="i18n-trace-step" :class="`i18n-step-${step.kind}`">
            <span class="i18n-trace-kind">{{ step.kind }}</span>
            <code class="i18n-trace-detail">{{ JSON.stringify(step) }}</code>
          </li>
        </ol>
      </div>
      <div v-else-if="resolveKey" class="i18n-muted">Type a key above…</div>
      <div v-else class="i18n-muted">Enter a convention key (e.g. <code>entities.books.fields.title</code>) to see how it resolves.</div>
    </div>

    <!-- ─── Missing keys ────────────────────────────────────────────── -->
    <div v-else-if="activeSection === 'missing'" class="i18n-section">
      <div class="i18n-missing-toolbar">
        <input
          v-model="missingFilter"
          type="text"
          placeholder="filter…"
          class="i18n-key-input"
        />
        <button class="debug-toolbar-btn" :disabled="entries.length === 0" @click="copyMissingSkeleton">
          <i class="pi pi-copy" /> Copy skeleton
        </button>
        <button class="debug-toolbar-btn" :disabled="entries.length === 0" @click="collector.clear()">
          <i class="pi pi-trash" /> Clear
        </button>
      </div>
      <div v-if="entries.length === 0" class="i18n-empty">
        <i class="pi pi-check-circle" />
        <span>No missing keys captured (yet).</span>
      </div>
      <div v-else>
        <div v-for="group in missingGrouped" :key="group.ns" class="i18n-missing-group">
          <div class="i18n-missing-group-header">
            <i class="pi pi-folder" />
            <span class="i18n-missing-group-name">{{ group.ns }}</span>
            <span class="i18n-muted">({{ group.entries.length }})</span>
          </div>
          <div v-for="e in group.entries" :key="`${e.key}|${e.locale}`" class="i18n-missing-entry">
            <code class="i18n-missing-key">{{ e.key }}</code>
            <span class="i18n-chip">{{ e.locale }}</span>
            <span class="i18n-muted">× {{ e.count }}</span>
            <span class="i18n-muted i18n-missing-time">{{ formatTime(e.lastSeen) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Coverage matrix ─────────────────────────────────────────── -->
    <div v-else-if="activeSection === 'coverage'" class="i18n-section">
      <div v-if="coverageEntities.length === 0" class="i18n-muted">No registered entities.</div>
      <div v-else>
        <table class="i18n-coverage-table">
          <thead>
            <tr>
              <th>entity</th>
              <th v-for="loc in availableLocales" :key="loc">{{ loc }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entity in coverageEntities" :key="entity">
              <td class="i18n-coverage-entity">{{ entity }}</td>
              <td v-for="loc in availableLocales" :key="loc"
                  class="i18n-coverage-cell"
                  :class="`i18n-cov-${coverageByEntity[entity]?.[loc]?.status ?? 'none'}`"
                  @click="drillDown(entity, loc)">
                <span v-if="coverageByEntity[entity]?.[loc]">
                  {{ coverageByEntity[entity][loc].hits }}/{{ coverageByEntity[entity][loc].total }}
                </span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="drillCell" class="i18n-coverage-drill">
          <div class="i18n-coverage-drill-header">
            <strong>{{ drillCell.entity }}</strong>
            <span class="i18n-chip">{{ drillCell.locale }}</span>
            <button class="debug-toolbar-btn" @click="drillCell = null">
              <i class="pi pi-times" />
            </button>
          </div>
          <ul class="i18n-coverage-drill-list">
            <li v-for="f in drillCell.fields" :key="f.name" :class="{ 'i18n-cov-hit': f.hit, 'i18n-cov-miss': !f.hit }">
              <i :class="['pi', f.hit ? 'pi-check' : 'pi-times']" />
              <code>{{ f.name }}</code>
              <span class="i18n-coverage-result">"{{ f.result }}"</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ─── Bundle inspector ────────────────────────────────────────── -->
    <div v-else-if="activeSection === 'bundle'" class="i18n-section">
      <div class="i18n-bundle-toolbar">
        <select v-model="bundleLocale" class="i18n-select">
          <option v-for="loc in availableLocales" :key="loc" :value="loc">{{ loc }}</option>
        </select>
        <button class="debug-toolbar-btn" :disabled="!bundleData" @click="downloadBundle">
          <i class="pi pi-download" /> Dump JSON
        </button>
      </div>
      <div v-if="bundleData" class="i18n-bundle-tree">
        <ObjectTree :data="bundleData" :expanded="false" />
      </div>
      <div v-else class="i18n-muted">No bundle loaded for this locale.</div>
    </div>
  </div>
</template>

<style scoped>
.i18n-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

.i18n-tabs {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--p-surface-700, #2a2a2a);
  flex-shrink: 0;
}

.i18n-tab {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 10px;
  color: var(--p-text-muted-color, #888);
  cursor: pointer;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.i18n-tab:hover {
  background: var(--p-surface-800, #1f1f1f);
  color: var(--p-text-color, #ddd);
}

.i18n-tab-active {
  background: var(--p-surface-800, #1f1f1f);
  color: var(--p-primary-color, #ec4899);
  border-color: var(--p-primary-color, #ec4899);
}

.i18n-tab-count {
  background: var(--p-primary-color, #ec4899);
  color: #fff;
  border-radius: 9px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 16px;
}

.i18n-section {
  flex: 1;
  overflow: auto;
  padding: 10px 12px;
}

.i18n-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--p-text-muted-color, #888);
}

.i18n-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.i18n-row-label {
  width: 120px;
  flex-shrink: 0;
  color: var(--p-text-muted-color, #888);
}

.i18n-row-value {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.i18n-select,
.i18n-key-input {
  background: var(--p-surface-900, #121212);
  color: var(--p-text-color, #ddd);
  border: 1px solid var(--p-surface-600, #404040);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: inherit;
  min-width: 0;
}

.i18n-key-input {
  flex: 1;
}

.i18n-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--p-surface-800, #1f1f1f);
  border: 1px solid var(--p-surface-600, #404040);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 10px;
}

.i18n-chip-hit {
  border-color: #10b981;
  color: #10b981;
}

.i18n-chip-miss {
  border-color: #ef4444;
  color: #ef4444;
}

.i18n-muted {
  color: var(--p-text-muted-color, #888);
}

/* Resolve tester */
.i18n-resolve-input {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.i18n-resolve-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--p-surface-700, #2a2a2a);
  margin-bottom: 8px;
}

.i18n-resolve-value {
  font-family: var(--font-mono, monospace);
  color: var(--p-primary-color, #ec4899);
}

.i18n-trace {
  list-style: none;
  padding: 0;
  margin: 0;
}

.i18n-trace-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}

.i18n-trace-kind {
  width: 140px;
  flex-shrink: 0;
  color: var(--p-text-muted-color, #888);
}

.i18n-trace-detail {
  word-break: break-all;
  background: transparent;
  color: var(--p-text-color, #ddd);
}

.i18n-step-miss .i18n-trace-kind { color: #ef4444; }
.i18n-step-snake-case-fallback .i18n-trace-kind { color: #f59e0b; }
.i18n-step-alias-pattern .i18n-trace-kind,
.i18n-step-alias-value .i18n-trace-kind { color: #06b6d4; }

/* Missing keys */
.i18n-missing-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.i18n-missing-group {
  margin-bottom: 12px;
}

.i18n-missing-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-weight: 600;
}

.i18n-missing-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0 3px 20px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}

.i18n-missing-key {
  flex: 1;
  background: transparent;
  color: var(--p-text-color, #ddd);
}

.i18n-missing-time {
  font-size: 10px;
}

/* Coverage matrix */
.i18n-coverage-table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 12px;
}

.i18n-coverage-table th,
.i18n-coverage-table td {
  border: 1px solid var(--p-surface-700, #2a2a2a);
  padding: 6px 10px;
  text-align: center;
  font-size: 11px;
}

.i18n-coverage-table th {
  background: var(--p-surface-800, #1f1f1f);
  color: var(--p-text-muted-color, #888);
  font-weight: 500;
}

.i18n-coverage-entity {
  text-align: left !important;
  font-family: var(--font-mono, monospace);
}

.i18n-coverage-cell {
  cursor: pointer;
  transition: filter 0.1s;
}

.i18n-coverage-cell:hover {
  filter: brightness(1.2);
}

.i18n-cov-green {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.i18n-cov-yellow {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.i18n-cov-red {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.i18n-coverage-drill {
  margin-top: 12px;
  padding: 10px;
  background: var(--p-surface-800, #1f1f1f);
  border-radius: 4px;
}

.i18n-coverage-drill-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.i18n-coverage-drill-header > .debug-toolbar-btn {
  margin-left: auto;
}

.i18n-coverage-drill-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}

.i18n-coverage-drill-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}

.i18n-coverage-drill-list .i18n-cov-hit i { color: #10b981; }
.i18n-coverage-drill-list .i18n-cov-miss i { color: #ef4444; }

.i18n-coverage-result {
  color: var(--p-text-muted-color, #888);
}

/* Bundle inspector */
.i18n-bundle-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.i18n-bundle-tree {
  background: var(--p-surface-900, #121212);
  border: 1px solid var(--p-surface-700, #2a2a2a);
  border-radius: 4px;
  padding: 8px;
  max-height: 600px;
  overflow: auto;
}
</style>
