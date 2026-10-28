<script setup lang="ts">
/**
 * PayloadViewer - a captured message in its own format (#4112)
 *
 * Usage:
 *   <PayloadViewer :body="capture.body" :content-type="capture.content_type" />
 *   <PayloadViewer :body="capture.body" :request="{ method: 'POST', url, status: 200, headers }" :mask="maskKeys()" />
 *
 * JSON goes to JsonViewer; XML is indented and highlighted (tokenized by
 * hand, never parsed as HTML); CSV is a table; form-encoded a key/value
 * table; text gets line numbers; a binary file shows its size, the first
 * bytes in hex, and a download.
 */
import { computed, inject, ref } from 'vue'
import QdButton from '../base/QdButton.vue'
import JsonViewer from '../editors/JsonViewer.vue'
import { useI18n } from '../../i18n/useI18n'
import {
  bodyText,
  detectFormat,
  FORMAT_EXTENSIONS,
  hexDump,
  maskCsv,
  maskHeaders,
  maskJson,
  parseCsv,
  parseForm,
  parseJson,
  prettyXml,
  piecesText,
  toBytes,
  isBinary,
  type PayloadBody,
  type PayloadFormat,
  type PayloadMask,
} from '../../utils/payload'
import { useFormatBytes } from '../../composables/useFormatBytes'

export interface PayloadRequest {
  method?: string
  url?: string
  status?: number | null
  headers?: Record<string, unknown> | null
}

interface Props {
  body?: PayloadBody
  contentType?: string | null
  /** Force a format instead of detecting it. */
  format?: PayloadFormat | null
  /** HTTP context shown above the body. */
  request?: PayloadRequest | null
  /** Hide values (tokens, passwords) before display, copy and download. */
  mask?: PayloadMask | null
  maxHeight?: string
  /** CSV rows shown before "show all". */
  csvRows?: number
  filename?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  body: null,
  contentType: null,
  format: null,
  request: null,
  mask: null,
  maxHeight: '28rem',
  csvRows: 200,
  filename: null,
})

const { t } = useI18n()
const formatBytes = useFormatBytes()
const orchestrator = inject<{ toast: { success: (...a: unknown[]) => void; error: (...a: unknown[]) => void } } | null>('qdadmOrchestrator', null)

const contentTypeHeader = computed(() => {
  const headers = props.request?.headers ?? {}
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
  return key ? String(headers[key]) : null
})

const format = computed<PayloadFormat>(() => detectFormat(props.body, props.contentType ?? contentTypeHeader.value, props.format))

// --- Renderings ---

const json = computed(() => {
  if (format.value !== 'json') return null
  const parsed = parseJson(props.body)
  return parsed.ok ? { ok: true as const, value: maskJson(parsed.value, props.mask) } : parsed
})

const xml = computed(() => (format.value === 'xml' ? prettyXml(bodyText(props.body), props.mask) : null))

const csvHeader = ref(true)
const csvAll = ref(false)
const csv = computed(() => {
  if (format.value !== 'csv') return null
  const { separator, rows } = parseCsv(bodyText(props.body))
  return { separator, rows: maskCsv(rows, props.mask, csvHeader.value) }
})
const csvHead = computed(() => (csv.value && csvHeader.value ? csv.value.rows[0] ?? [] : null))
const csvBody = computed(() => {
  if (!csv.value) return []
  const rows = csvHeader.value ? csv.value.rows.slice(1) : csv.value.rows
  return csvAll.value ? rows : rows.slice(0, props.csvRows)
})
const csvTotal = computed(() => (csv.value ? csv.value.rows.length - (csvHeader.value ? 1 : 0) : 0))
const csvWidth = computed(() => Math.max(0, ...(csv.value?.rows.map((r) => r.length) ?? [0])))

const form = computed(() => (format.value === 'form' ? parseForm(bodyText(props.body), props.mask) : null))

const textLines = computed(() => (format.value === 'text' ? bodyText(props.body).replace(/\r\n?/g, '\n').split('\n') : []))

const bytes = computed(() => (format.value === 'binary' ? toBytes(props.body) : null))
const hex = computed(() => (bytes.value ? hexDump(bytes.value) : []))

/** Why the body is shown as text: the format it claims did not parse. */
const fallback = computed<string | null>(() => {
  if (json.value && !json.value.ok) return t('core.payload.malformed', { format: 'JSON', error: json.value.error })
  if (xml.value && !xml.value.ok) return t('core.payload.malformed', { format: 'XML', error: xml.value.error ?? '' })
  return null
})

// --- Request block ---

const headers = computed(() => maskHeaders(props.request?.headers, props.mask))
const statusClass = computed(() => {
  const s = props.request?.status
  if (!s) return ''
  return s >= 500 ? 'pl-status--error' : s >= 400 ? 'pl-status--warn' : s >= 300 ? 'pl-status--info' : 'pl-status--ok'
})

// --- Copy and download: what is shown, masked ---

const shownText = computed<string>(() => {
  if (json.value?.ok) return JSON.stringify(json.value.value, null, 2)
  if (xml.value?.ok) return xml.value.lines.map(piecesText).join('\n')
  if (csv.value) return csv.value.rows.map((r) => r.map((c) => (/["\n]|[,;\t|]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(csv.value!.separator)).join('\n')
  if (form.value) return new URLSearchParams(form.value).toString()
  return bodyText(props.body)
})

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shownText.value)
    orchestrator?.toast.success(t('core.payload.copied'), undefined, 'PayloadViewer')
  } catch {
    orchestrator?.toast.error(t('core.payload.copyFailed'), undefined, 'PayloadViewer')
  }
}

function download(): void {
  const blob = isBinary(props.body) && format.value === 'binary'
    ? new Blob([toBytes(props.body) as BlobPart], { type: props.contentType ?? 'application/octet-stream' })
    : new Blob([shownText.value], { type: `${props.contentType ?? 'text/plain'};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.filename ?? `payload.${FORMAT_EXTENSIONS[format.value]}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

defineExpose({ format })
</script>

<template>
  <div class="qd-payload" :data-format="format">
    <div v-if="request" class="qd-payload-request">
      <div class="qd-payload-line">
        <span v-if="request.method" class="pl-method">{{ request.method.toUpperCase() }}</span>
        <span v-if="request.url" class="pl-url">{{ request.url }}</span>
        <span v-if="request.status" class="pl-status" :class="statusClass">{{ request.status }}</span>
      </div>
      <details v-if="headers.length" class="qd-payload-headers">
        <summary>{{ t('core.payload.headers', { count: headers.length }) }}</summary>
        <table>
          <tbody>
            <tr v-for="[name, value] in headers" :key="name">
              <th>{{ name }}</th>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>

    <div class="qd-payload-toolbar">
      <span class="qd-payload-format">{{ format.toUpperCase() }}</span>
      <span v-if="bytes" class="qd-payload-size">{{ formatBytes(bytes.length) }}</span>
      <label v-if="csv" class="qd-payload-check">
        <input v-model="csvHeader" type="checkbox" /> {{ t('core.payload.headerRow') }}
      </label>
      <span class="qd-payload-spacer" />
      <QdButton v-if="format !== 'binary'" icon="pi pi-copy" text rounded size="small" :aria-label="t('core.payload.copy')"
        v-tooltip.top="t('core.payload.copy')" @click="copy" />
      <QdButton icon="pi pi-download" text rounded size="small" :aria-label="t('core.payload.download')"
        v-tooltip.top="t('core.payload.download')" @click="download" />
    </div>

    <div v-if="fallback" class="qd-payload-warning"><i class="pi pi-exclamation-triangle" /> {{ fallback }}</div>

    <div class="qd-payload-body" :style="{ maxHeight }">
      <JsonViewer v-if="json && json.ok" :model-value="(json.value as never)" />

      <pre v-else-if="xml" class="qd-payload-code"><template v-for="(line, i) in xml.lines" :key="i"><span class="pl-n">{{ i + 1 }}</span><span v-for="(p, j) in line" :key="j" :class="p.cls">{{ p.text }}</span>
</template></pre>

      <div v-else-if="csv" class="qd-payload-table-wrap">
        <table class="qd-payload-table">
          <thead v-if="csvHead">
            <tr>
              <th class="pl-n" />
              <th v-for="(h, i) in csvHead" :key="i">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in csvBody" :key="r">
              <td class="pl-n">{{ r + 1 }}</td>
              <td v-for="c in csvWidth" :key="c">{{ row[c - 1] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
        <button v-if="!csvAll && csvTotal > csvBody.length" type="button" class="qd-payload-more" @click="csvAll = true">
          {{ t('core.payload.showAll', { count: csvTotal }) }}
        </button>
      </div>

      <table v-else-if="form" class="qd-payload-table qd-payload-kv">
        <tbody>
          <tr v-for="([k, v], i) in form" :key="i">
            <th>{{ k }}</th>
            <td>{{ v }}</td>
          </tr>
        </tbody>
      </table>

      <div v-else-if="bytes" class="qd-payload-binary">
        <p>{{ t('core.payload.binary', { size: formatBytes(bytes.length) }) }}</p>
        <pre class="qd-payload-code">{{ hex.join('\n') }}</pre>
      </div>

      <pre v-else class="qd-payload-code"><template v-for="(line, i) in (fallback ? bodyText(body).split('\n') : textLines)" :key="i"><span class="pl-n">{{ i + 1 }}</span>{{ line }}
</template></pre>
    </div>
  </div>
</template>
