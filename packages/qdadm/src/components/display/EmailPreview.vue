<script setup lang="ts">
/**
 * EmailPreview - a captured email, shown where it belongs (#4113)
 *
 * Usage:
 *   <EmailPreview :email="{ from, to, subject, date, html, text, attachments }" />
 *   <EmailPreview :email="fromMailpit(message, mailpitUrl)" />
 *   <EmailPreview :raw="eml" :parser="parseMime" />   // parseMime from '@quazardous/qdadm/email'
 *
 * The HTML part renders in an iframe with no scripts and an opaque origin,
 * behind a CSP that lets nothing remote load. Remote images are blocked
 * until the user asks for them, since an image is how a sender learns the
 * mail was opened. The text part and the source are plain text.
 */
import { computed, ref, watch } from 'vue'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { useFormatBytes } from '../../composables/useFormatBytes'
import {
  attachmentSize,
  attachmentUrl,
  countRemoteImages,
  EMAIL_SANDBOX,
  emailDocument,
  formatAddresses,
  headerList,
  type EmailAttachment,
  type EmailParser,
  type ParsedEmail,
} from '../../utils/email'

interface Props {
  /** A parsed email. */
  email?: ParsedEmail | null
  /** A raw MIME message, read by `parser`. */
  raw?: string | ArrayBuffer | Uint8Array | null
  parser?: EmailParser | null
  /** Height of the HTML view; the user can resize it. */
  height?: string
  /** Let remote images load from the start. */
  loadImages?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  email: null,
  raw: null,
  parser: null,
  height: '32rem',
  loadImages: false,
})

const { t, locale } = useI18n()
const formatBytes = useFormatBytes()

// --- The email ---

const parsed = ref<ParsedEmail | null>(null)
const parseError = ref<string | null>(null)

watch(
  () => [props.email, props.raw, props.parser] as const,
  async ([email, raw, parser]) => {
    parseError.value = null
    if (email) {
      parsed.value = email
      return
    }
    if (raw === null || raw === undefined) {
      parsed.value = null
      return
    }
    if (!parser) {
      parsed.value = { raw: typeof raw === 'string' ? raw : new TextDecoder().decode(raw) }
      parseError.value = t('core.email.noParser')
      return
    }
    try {
      parsed.value = await parser(raw)
    } catch (err) {
      parsed.value = { raw: typeof raw === 'string' ? raw : new TextDecoder().decode(raw) }
      parseError.value = err instanceof Error ? err.message : String(err)
    }
  },
  { immediate: true }
)

// --- Tabs ---

type Tab = 'html' | 'text' | 'source'
const tabs = computed<Tab[]>(() => {
  const e = parsed.value
  if (!e) return []
  const out: Tab[] = []
  if (e.html) out.push('html')
  if (e.text) out.push('text')
  if (e.raw) out.push('source')
  return out
})
const tab = ref<Tab>('html')
watch(tabs, (list) => {
  if (!list.includes(tab.value)) tab.value = list[0] ?? 'html'
}, { immediate: true })

// --- HTML ---

const imagesAllowed = ref(props.loadImages)
watch(parsed, () => (imagesAllowed.value = props.loadImages))

const remoteImages = computed(() => (parsed.value?.html ? countRemoteImages(parsed.value.html) : 0))
const srcdoc = computed(() =>
  parsed.value?.html
    ? emailDocument(parsed.value.html, { attachments: parsed.value.attachments, allowRemoteImages: imagesAllowed.value })
    : ''
)

// --- Headers ---

const dateText = computed(() => {
  const d = parsed.value?.date
  if (!d) return ''
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? String(d) : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
})

const mainHeaders = computed(() => {
  const e = parsed.value
  if (!e) return []
  return [
    ['from', formatAddresses(e.from)],
    ['to', formatAddresses(e.to)],
    ['cc', formatAddresses(e.cc)],
    ['replyTo', formatAddresses(e.replyTo)],
    ['date', dateText.value],
  ].filter(([, v]) => v) as Array<[string, string]>
})
const allHeaders = computed(() => (parsed.value ? headerList(parsed.value) : []))

// --- Attachments ---

interface AttachmentRow {
  att: EmailAttachment
  url: string | null
  size: number | null
  image: boolean
  inline: boolean
}

const attachments = computed<AttachmentRow[]>(() =>
  (parsed.value?.attachments ?? []).map((att) => ({
    att,
    url: attachmentUrl(att),
    size: attachmentSize(att),
    image: (att.contentType ?? '').startsWith('image/') && !(att.contentType ?? '').includes('svg'),
    inline: att.disposition === 'inline' || (!!att.contentId && att.disposition !== 'attachment'),
  }))
)

function download(row: AttachmentRow): void {
  if (!row.url) return
  const a = document.createElement('a')
  a.href = row.url
  a.download = row.att.filename ?? 'attachment'
  a.rel = 'noopener'
  a.click()
}
</script>

<template>
  <div class="qd-email">
    <header v-if="parsed" class="qd-email-head">
      <h3 class="qd-email-subject">{{ parsed.subject || t('core.email.noSubject') }}</h3>
      <dl class="qd-email-main">
        <template v-for="[key, value] in mainHeaders" :key="key">
          <dt>{{ t(`core.email.${key}`) }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
      <details v-if="allHeaders.length" class="qd-email-headers">
        <summary>{{ t('core.email.allHeaders', { count: allHeaders.length }) }}</summary>
        <table>
          <tbody>
            <tr v-for="(h, i) in allHeaders" :key="i">
              <th>{{ h.key }}</th>
              <td>{{ h.value }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </header>

    <div v-if="parseError" class="qd-email-warning"><i class="pi pi-exclamation-triangle" /> {{ parseError }}</div>

    <div v-if="tabs.length" class="qd-email-tabs" role="tablist">
      <button v-for="name in tabs" :key="name" type="button" role="tab" class="qd-email-tab"
        :class="{ 'qd-email-tab--active': tab === name }" :aria-selected="tab === name" @click="tab = name">
        {{ t(`core.email.tab.${name}`) }}
      </button>
      <span class="qd-email-spacer" />
      <template v-if="tab === 'html' && remoteImages > 0">
        <span v-if="!imagesAllowed" class="qd-email-blocked"><i class="pi pi-eye-slash" /> {{ t('core.email.imagesBlocked', { count: remoteImages }) }}</span>
        <QdButton size="small" text :icon="imagesAllowed ? 'pi pi-eye-slash' : 'pi pi-image'"
          :label="imagesAllowed ? t('core.email.blockImages') : t('core.email.loadImages')" @click="imagesAllowed = !imagesAllowed" />
      </template>
    </div>

    <div v-if="tab === 'html' && parsed?.html" class="qd-email-frame-wrap" :style="{ height }">
      <iframe :key="String(imagesAllowed)" class="qd-email-frame" :sandbox="EMAIL_SANDBOX" :srcdoc="srcdoc"
        referrerpolicy="no-referrer" :title="parsed.subject || t('core.email.noSubject')" />
    </div>
    <pre v-else-if="tab === 'text' && parsed?.text" class="qd-email-text">{{ parsed.text }}</pre>
    <pre v-else-if="tab === 'source' && parsed?.raw" class="qd-email-text qd-email-source">{{ parsed.raw }}</pre>
    <div v-else-if="parsed && !tabs.length" class="qd-email-empty">{{ t('core.email.empty') }}</div>

    <ul v-if="attachments.length" class="qd-email-attachments">
      <li v-for="(row, i) in attachments" :key="i" class="qd-email-attachment">
        <img v-if="row.image && row.url" class="qd-email-thumb" :src="row.url" alt="" referrerpolicy="no-referrer" />
        <i v-else class="pi pi-paperclip qd-email-clip" />
        <span class="qd-email-att-name">{{ row.att.filename || t('core.email.unnamed') }}</span>
        <span class="qd-email-att-meta">
          {{ row.att.contentType }}<template v-if="row.size !== null"> · {{ formatBytes(row.size) }}</template>
          <template v-if="row.inline"> · {{ t('core.email.inline') }}</template>
        </span>
        <QdButton icon="pi pi-download" text rounded size="small" :disabled="!row.url" :aria-label="t('core.email.download')"
          v-tooltip.top="t('core.email.download')" @click="download(row)" />
      </li>
    </ul>
  </div>
</template>
