<script setup lang="ts">
/**
 * PayloadDiff - compare two payloads, "expected" against "captured" (#4112)
 *
 * Usage:
 *   <PayloadDiff :left="expected" :right="capture.body" content-type="application/xml" />
 *   <PayloadDiff :left="feedA" :right="feedB" format="csv" csv-key="sku" />
 *
 * Both sides are normalised first (JSON with sorted keys, XML indented, form
 * fields sorted), then compared line by line: formatting noise disappears,
 * so what is left reads as a difference of content. A CSV with `csv-key` is
 * compared row by row on that column, cell by cell by header name.
 */
import { computed, ref } from 'vue'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import {
  bodyText,
  detectFormat,
  diffCsv,
  diffLines,
  maskCsv,
  normalizeLines,
  parseCsv,
  type DiffOp,
  type PayloadBody,
  type PayloadFormat,
  type PayloadMask,
} from '../../utils/payload'

interface Props {
  left?: PayloadBody
  right?: PayloadBody
  labels?: [string, string] | null
  mode?: 'split' | 'inline'
  format?: PayloadFormat | null
  contentType?: string | null
  /** CSV only: compare rows matched on this column. */
  csvKey?: string | null
  mask?: PayloadMask | null
  /** Unchanged lines kept around each change; longer runs fold. */
  context?: number
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  left: null,
  right: null,
  labels: null,
  mode: 'split',
  format: null,
  contentType: null,
  csvKey: null,
  mask: null,
  context: 3,
  maxHeight: '32rem',
})

const { t } = useI18n()
const labels = computed(() => props.labels ?? [t('core.payload.expected'), t('core.payload.captured')])
const currentMode = ref(props.mode)

const format = computed<PayloadFormat>(() => props.format ?? detectFormat(props.left ?? props.right, props.contentType))

// --- Keyed CSV ---

const csvDiff = computed(() => {
  if (format.value !== 'csv' || !props.csvKey) return null
  const l = maskCsv(parseCsv(bodyText(props.left)).rows, props.mask, true)
  const r = maskCsv(parseCsv(bodyText(props.right)).rows, props.mask, true)
  return diffCsv(l, r, props.csvKey)
})
const csvCounts = computed(() => {
  const out = { added: 0, removed: 0, changed: 0, same: 0 }
  for (const row of csvDiff.value?.rows ?? []) out[row.status]++
  return out
})
const showSame = ref(false)

// --- Lines ---

const ops = computed<DiffOp[]>(() =>
  csvDiff.value ? [] : diffLines(normalizeLines(props.left, format.value, props.mask), normalizeLines(props.right, format.value, props.mask))
)
const counts = computed(() => ({
  added: ops.value.filter((o) => o.type === 'insert').length,
  removed: ops.value.filter((o) => o.type === 'delete').length,
}))
const identical = computed(() => (csvDiff.value ? csvCounts.value.added + csvCounts.value.removed + csvCounts.value.changed === 0 : counts.value.added + counts.value.removed === 0))

interface Hunk {
  type: 'ops' | 'fold'
  key: string
  ops: DiffOp[]
}

const unfolded = ref(new Set<string>())

/** Long runs of unchanged lines fold, keeping `context` lines around each change. */
const hunks = computed<Hunk[]>(() => {
  const list = ops.value
  const keep = new Array<boolean>(list.length).fill(false)
  list.forEach((op, i) => {
    if (op.type === 'equal') return
    for (let j = Math.max(0, i - props.context); j <= Math.min(list.length - 1, i + props.context); j++) keep[j] = true
  })
  const out: Hunk[] = []
  let i = 0
  while (i < list.length) {
    const start = i
    const kept = keep[i] || list.length <= props.context * 2 + 1
    while (i < list.length && (keep[i] || list.length <= props.context * 2 + 1) === kept) i++
    const slice = list.slice(start, i)
    const key = `${start}`
    if (kept || slice.length < 4 || unfolded.value.has(key)) out.push({ type: 'ops', key, ops: slice })
    else out.push({ type: 'fold', key, ops: slice })
  }
  return out
})

function unfold(key: string): void {
  unfolded.value = new Set([...unfolded.value, key])
}

interface SplitRow {
  left?: DiffOp
  right?: DiffOp
}

/** Side by side: a run of deletions faces the run of insertions that follows it. */
function splitRows(list: DiffOp[]): SplitRow[] {
  const rows: SplitRow[] = []
  let i = 0
  while (i < list.length) {
    const op = list[i]!
    if (op.type === 'equal') {
      rows.push({ left: op, right: op })
      i++
      continue
    }
    const dels: DiffOp[] = []
    const ins: DiffOp[] = []
    while (i < list.length && list[i]!.type === 'delete') dels.push(list[i++]!)
    while (i < list.length && list[i]!.type === 'insert') ins.push(list[i++]!)
    for (let k = 0; k < Math.max(dels.length, ins.length); k++) rows.push({ left: dels[k], right: ins[k] })
  }
  return rows
}
</script>

<template>
  <div class="qd-payload qd-payload-diff">
    <div class="qd-payload-toolbar">
      <span class="qd-payload-format">{{ format.toUpperCase() }}</span>
      <template v-if="csvDiff">
        <span class="pl-count pl-count--add">+{{ csvCounts.added }}</span>
        <span class="pl-count pl-count--del">−{{ csvCounts.removed }}</span>
        <span class="pl-count pl-count--chg">~{{ csvCounts.changed }}</span>
        <label class="qd-payload-check"><input v-model="showSame" type="checkbox" /> {{ t('core.payload.showSame', { count: csvCounts.same }) }}</label>
      </template>
      <template v-else>
        <span class="pl-count pl-count--add">+{{ counts.added }}</span>
        <span class="pl-count pl-count--del">−{{ counts.removed }}</span>
      </template>
      <span class="qd-payload-spacer" />
      <QdButton v-if="!csvDiff" size="small" text :icon="currentMode === 'split' ? 'pi pi-bars' : 'pi pi-pause'"
        :label="currentMode === 'split' ? t('core.payload.inline') : t('core.payload.split')"
        @click="currentMode = currentMode === 'split' ? 'inline' : 'split'" />
    </div>

    <div v-if="identical" class="qd-payload-identical"><i class="pi pi-check" /> {{ t('core.payload.identical') }}</div>

    <div class="qd-payload-body" :style="{ maxHeight }">
      <table v-if="csvDiff" class="qd-payload-table pl-csv-diff">
        <thead>
          <tr>
            <th class="pl-n" />
            <th v-for="h in csvDiff.header" :key="h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in csvDiff.rows" :key="row.key">
            <tr v-if="row.status !== 'same' || showSame" :class="`pl-row--${row.status}`">
              <td class="pl-n">{{ row.status === 'added' ? '+' : row.status === 'removed' ? '−' : row.status === 'changed' ? '~' : '' }}</td>
              <td v-for="(h, c) in csvDiff.header" :key="h" :class="{ 'pl-cell--changed': row.changed.includes(c) }">
                <template v-if="row.changed.includes(c)">
                  <del>{{ row.left?.[c] }}</del> <ins>{{ row.right?.[c] }}</ins>
                </template>
                <template v-else>{{ (row.right ?? row.left)?.[c] }}</template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <table v-else-if="currentMode === 'split'" class="pl-diff pl-diff--split">
        <thead>
          <tr>
            <th colspan="2">{{ labels[0] }}</th>
            <th colspan="2">{{ labels[1] }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="hunk in hunks" :key="hunk.key">
            <tr v-if="hunk.type === 'fold'" class="pl-fold">
              <td colspan="4"><button type="button" @click="unfold(hunk.key)">{{ t('core.payload.unchanged', { count: hunk.ops.length }) }}</button></td>
            </tr>
            <tr v-for="(row, i) in (hunk.type === 'ops' ? splitRows(hunk.ops) : [])" v-else :key="`${hunk.key}:${i}`">
              <td class="pl-n">{{ row.left?.left !== undefined ? row.left.left + 1 : '' }}</td>
              <td :class="row.left ? (row.left.type === 'delete' ? 'pl-del' : '') : 'pl-empty'">{{ row.left?.text }}</td>
              <td class="pl-n">{{ row.right?.right !== undefined ? row.right.right + 1 : '' }}</td>
              <td :class="row.right ? (row.right.type === 'insert' ? 'pl-ins' : '') : 'pl-empty'">{{ row.right?.text }}</td>
            </tr>
          </template>
        </tbody>
      </table>

      <table v-else class="pl-diff pl-diff--inline">
        <tbody>
          <template v-for="hunk in hunks" :key="hunk.key">
            <tr v-if="hunk.type === 'fold'" class="pl-fold">
              <td colspan="4"><button type="button" @click="unfold(hunk.key)">{{ t('core.payload.unchanged', { count: hunk.ops.length }) }}</button></td>
            </tr>
            <tr v-for="(op, i) in (hunk.type === 'ops' ? hunk.ops : [])" v-else :key="`${hunk.key}:${i}`"
              :class="op.type === 'delete' ? 'pl-del' : op.type === 'insert' ? 'pl-ins' : ''">
              <td class="pl-n">{{ op.left !== undefined ? op.left + 1 : '' }}</td>
              <td class="pl-n">{{ op.right !== undefined ? op.right + 1 : '' }}</td>
              <td class="pl-sign">{{ op.type === 'delete' ? '−' : op.type === 'insert' ? '+' : '' }}</td>
              <td>{{ op.text }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
