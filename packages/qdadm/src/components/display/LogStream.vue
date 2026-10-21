<script setup lang="ts">
/**
 * LogStream - live tail of a backend log (#4110)
 *
 * Shows a task's log as the worker writes it, then the whole log once done.
 *
 * Usage:
 *   <LogStream :source="{ poll: (from) => fetchLog(task.id, from) }" error-pattern="ERROR|FATAL" />
 *   <LogStream :stream="myStream" height="60vh" />   // a useLogStream() the page already holds
 *
 * - follow: on by default; scrolling up pauses it, scrolling back to the end
 *   (or End, or the "new lines" button) resumes it.
 * - Without wrapping, only the rows on screen are rendered (fixed line
 *   height), so a log of tens of thousands of lines scrolls freely. With
 *   wrapping, rows have no fixed height: every row is in the DOM and the
 *   browser skips painting the ones off screen (content-visibility).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { ansiStyleToCss } from '../../utils/ansi'
import { useLogStream, type LogLine, type LogSource, type UseLogStreamReturn } from '../../composables/useLogStream'

interface Props {
  /** Where the lines come from; ignored when `stream` is given. */
  source?: LogSource | null
  /** A stream the page already holds (shared with another view). */
  stream?: UseLogStreamReturn | null
  /** Lines matching it are marked, counted, and reachable from the toolbar. */
  errorPattern?: RegExp | string | null
  /** A timestamp at the start of a line, shown dimmed. */
  timestampPattern?: RegExp | string | null
  height?: string
  /** Row height in px, without wrapping. Matches the stylesheet's line-height. */
  lineHeight?: number
  wrap?: boolean
  follow?: boolean
  lineNumbers?: boolean
  filename?: string
  /** Download with the ANSI escapes kept. */
  downloadRaw?: boolean
  maxLines?: number
}

const props = withDefaults(defineProps<Props>(), {
  source: null,
  stream: null,
  errorPattern: null,
  timestampPattern: null,
  height: '24rem',
  lineHeight: 20,
  wrap: false,
  follow: true,
  lineNumbers: true,
  filename: 'log.txt',
  downloadRaw: false,
  maxLines: 100_000,
})

const emit = defineEmits<{
  /** The source reported the end of the log. */
  done: []
}>()

const { t } = useI18n()

const log: UseLogStreamReturn =
  props.stream ??
  useLogStream(props.source ?? { lines: [] }, { errorPattern: props.errorPattern, maxLines: props.maxLines })

const viewport = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const wrapping = ref(props.wrap)
const following = ref(props.follow)
const unseen = ref(0)
const query = ref('')
const onlyMatches = ref(false)
const currentMatch = ref(-1)
const currentError = ref(-1)
const OVERSCAN = 20

// A stream passed in may have been built without the pattern: flag here too.
const errorRe = computed(() => {
  const p = props.errorPattern
  if (!p) return null
  return typeof p === 'string' ? new RegExp(p, 'i') : new RegExp(p.source, p.flags.replace(/[gy]/g, ''))
})
const timestampRe = computed(() => {
  const p = props.timestampPattern
  if (!p) return null
  const source = typeof p === 'string' ? p : p.source
  return new RegExp(source.startsWith('^') ? source : `^(?:${source})`, typeof p === 'string' ? '' : p.flags.replace(/[gy]/g, ''))
})
const isError = (line: LogLine) => line.error || (errorRe.value ? errorRe.value.test(line.text) : false)

const needle = computed(() => query.value.trim().toLowerCase())
const isMatch = (line: LogLine) => needle.value !== '' && line.text.toLowerCase().includes(needle.value)

/** The lines on show: all of them, or the matching ones. */
const view = computed<LogLine[]>(() =>
  onlyMatches.value && needle.value ? log.lines.value.filter(isMatch) : log.lines.value
)
const matchIndexes = computed(() => {
  if (!needle.value) return []
  const out: number[] = []
  view.value.forEach((line, i) => isMatch(line) && out.push(i))
  return out
})
const errorIndexes = computed(() => {
  const out: number[] = []
  view.value.forEach((line, i) => isError(line) && out.push(i))
  return out
})

const visibleRows = computed(() => Math.ceil((viewportHeight.value || 400) / props.lineHeight))
// Clamped: when the view shrinks (only matches), scrollTop can still point
// past its end until the browser catches up.
const windowStart = computed(() => {
  if (wrapping.value) return 0
  const fromScroll = Math.floor(scrollTop.value / props.lineHeight) - OVERSCAN
  return Math.max(0, Math.min(fromScroll, view.value.length - visibleRows.value - OVERSCAN))
})
const windowRows = computed(() => {
  if (wrapping.value) return view.value
  const visible = visibleRows.value
  return view.value.slice(windowStart.value, windowStart.value + visible + OVERSCAN * 2)
})
const totalHeight = computed(() => view.value.length * props.lineHeight)

interface Piece {
  text: string
  style: Record<string, string>
  cls: string
}

/** A row's styled segments, cut again where the timestamp and the matches start and end. */
function pieces(line: LogLine): Piece[] {
  const ranges: Array<[number, number, string]> = []
  const ts = timestampRe.value?.exec(line.text)
  if (ts && ts[0].length > 0) ranges.push([0, ts[0].length, 'qd-log-ts'])
  if (needle.value) {
    const lower = line.text.toLowerCase()
    for (let at = lower.indexOf(needle.value); at !== -1; at = lower.indexOf(needle.value, at + needle.value.length)) {
      ranges.push([at, at + needle.value.length, 'qd-log-mark'])
    }
  }
  const out: Piece[] = []
  let offset = 0
  for (const seg of line.segments) {
    const style = ansiStyleToCss(seg.style)
    const end = offset + seg.text.length
    const cuts = new Set([offset, end])
    for (const [a, b] of ranges) {
      if (a > offset && a < end) cuts.add(a)
      if (b > offset && b < end) cuts.add(b)
    }
    const sorted = [...cuts].sort((x, y) => x - y)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      const cls = ranges.filter(([ra, rb]) => ra <= a && rb >= b).map((r) => r[2]).join(' ')
      out.push({ text: seg.text.slice(a - offset, b - offset), style, cls })
    }
    offset = end
  }
  return out
}

// --- Scrolling and follow ---

// No "programmatic scroll" flag: setting scrollTop to where it already is
// fires no scroll event, so such a flag would stay up and swallow the user's
// next scroll. Each scroll just asks whether the end is in view.
// Where the last scroll to the end left the viewport. Below it, the user has
// scrolled up; at it, nothing moved — including a log mounted hidden (a
// dialog not laid out yet), whose first scroll to the end did nothing.
let lastAutoTop = 0

function scrollToEnd(): void {
  const el = viewport.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  scrollTop.value = el.scrollTop
  lastAutoTop = el.scrollTop
}

function onScroll(): void {
  const el = viewport.value
  if (!el) return
  scrollTop.value = el.scrollTop
  const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - props.lineHeight
  following.value = atEnd
  if (atEnd) unseen.value = 0
}

function resume(): void {
  following.value = true
  unseen.value = 0
  void nextTick(scrollToEnd)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'End') {
    event.preventDefault()
    resume()
  }
}

watch(
  () => log.lines.value,
  (next, prev) => {
    const added = Math.max(0, (next.at(-1)?.n ?? 0) - (prev?.at(-1)?.n ?? 0))
    // Asked of the DOM, still at its old height: the scroll event of a user
    // who just scrolled up may not have arrived yet, and following on would
    // yank them back down.
    const el = viewport.value
    if (following.value && el && el.scrollTop < lastAutoTop - props.lineHeight) {
      following.value = false
    }
    if (following.value) void nextTick(scrollToEnd)
    else unseen.value += added
  }
)

/** Bring a row of the view to the middle of the viewport, and stop following. */
function reveal(index: number): void {
  const el = viewport.value
  if (!el) return
  following.value = false
  if (wrapping.value) {
    void nextTick(() => {
      el.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'center' })
    })
    return
  }
  el.scrollTop = Math.max(0, index * props.lineHeight - el.clientHeight / 2)
  scrollTop.value = el.scrollTop
}

function step(list: number[], current: { value: number }, delta: 1 | -1): void {
  if (list.length === 0) return
  current.value = (current.value + delta + list.length) % list.length
  reveal(list[current.value]!)
}

const nextMatch = () => step(matchIndexes.value, currentMatch, 1)
const previousMatch = () => step(matchIndexes.value, currentMatch, -1)
const nextError = () => step(errorIndexes.value, currentError, 1)

watch([needle, onlyMatches], () => {
  currentMatch.value = -1
})

function toggleWrap(): void {
  wrapping.value = !wrapping.value
  if (following.value) void nextTick(scrollToEnd)
}

function toggleFollow(): void {
  if (following.value) following.value = false
  else resume()
}

// --- Download ---

function download(): void {
  const body = log.lines.value.map((l) => (props.downloadRaw ? l.raw : l.text)).join('\n')
  const url = URL.createObjectURL(new Blob([body + '\n'], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = props.filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// --- Status ---

watch(
  () => log.status.value,
  (status) => status === 'done' && emit('done'),
  { immediate: true }
)

const statusLabel = computed(() => {
  switch (log.status.value) {
    case 'streaming':
      return t('core.log.streaming')
    case 'done':
      return t('core.log.done')
    case 'error':
      return t('core.log.failed', { error: log.error.value ?? '' })
    default:
      return t('core.log.stopped')
  }
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = viewport.value
  if (!el) return
  viewportHeight.value = el.clientHeight
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      viewportHeight.value = el.clientHeight
    })
    resizeObserver.observe(el)
  }
  if (following.value) scrollToEnd()
})

onBeforeUnmount(() => resizeObserver?.disconnect())

defineExpose({ log, resume, reveal })
</script>

<template>
  <div class="qd-log-stream" :class="{ 'qd-log-stream--wrap': wrapping }">
    <div class="qd-log-toolbar">
      <span class="qd-log-status" :class="`qd-log-status--${log.status.value}`">
        <span class="qd-log-status-dot" />
        {{ statusLabel }}
      </span>
      <span class="qd-log-count">{{ t('core.log.lines', { count: log.lines.value.length }) }}</span>
      <span class="qd-log-spacer-x" />
      <span class="qd-log-search">
        <InputText v-model="query" size="small" :placeholder="t('core.log.search')" :aria-label="t('core.log.search')"
          @keydown.enter.prevent="$event.shiftKey ? previousMatch() : nextMatch()" />
        <span v-if="needle" class="qd-log-search-count">
          {{ currentMatch >= 0 ? currentMatch + 1 : 0 }}/{{ matchIndexes.length }}
        </span>
        <QdButton icon="pi pi-chevron-up" text rounded size="small" :disabled="!matchIndexes.length"
          :aria-label="t('core.log.previous')" v-tooltip.top="t('core.log.previous')" @click="previousMatch" />
        <QdButton icon="pi pi-chevron-down" text rounded size="small" :disabled="!matchIndexes.length"
          :aria-label="t('core.log.next')" v-tooltip.top="t('core.log.next')" @click="nextMatch" />
        <QdButton icon="pi pi-filter" rounded size="small" :text="!onlyMatches" :disabled="!needle"
          :aria-label="t('core.log.onlyMatches')" :aria-pressed="onlyMatches" v-tooltip.top="t('core.log.onlyMatches')"
          @click="onlyMatches = !onlyMatches" />
      </span>
      <QdButton v-if="errorPattern" class="qd-log-errors" icon="pi pi-exclamation-triangle" size="small" text
        :severity="errorIndexes.length ? 'danger' : 'secondary'" :disabled="!errorIndexes.length"
        :label="t('core.log.errors', { count: errorIndexes.length })" v-tooltip.top="t('core.log.firstError')"
        @click="nextError" />
      <QdButton icon="pi pi-align-left" rounded size="small" :text="!wrapping" :aria-label="t('core.log.wrap')"
        :aria-pressed="wrapping" v-tooltip.top="t('core.log.wrap')" @click="toggleWrap" />
      <QdButton icon="pi pi-angle-double-down" rounded size="small" :text="!following" :aria-label="t('core.log.follow')"
        :aria-pressed="following" v-tooltip.top="t('core.log.follow')" @click="toggleFollow" />
      <QdButton icon="pi pi-download" text rounded size="small" :disabled="!log.lines.value.length"
        :aria-label="t('core.log.download')" v-tooltip.top="t('core.log.download')" @click="download" />
    </div>

    <div ref="viewport" class="qd-log-viewport" :style="{ height, '--qd-log-line-height': `${lineHeight}px` }" tabindex="0"
      @scroll="onScroll" @keydown="onKeydown">
      <div v-if="!view.length" class="qd-log-empty">{{ t('core.log.empty') }}</div>
      <div v-else :style="wrapping ? undefined : { height: `${totalHeight}px`, position: 'relative' }">
        <div :style="wrapping ? undefined : { transform: `translateY(${windowStart * lineHeight}px)` }">
          <div v-for="(line, i) in windowRows" :key="line.n" class="qd-log-line" :data-index="windowStart + i"
            :class="{
              'qd-log-line--error': isError(line),
              'qd-log-line--current': matchIndexes[currentMatch] === windowStart + i || errorIndexes[currentError] === windowStart + i,
            }">
            <span v-if="lineNumbers" class="qd-log-n">{{ line.n }}</span>
            <span class="qd-log-text"><span v-for="(p, j) in pieces(line)" :key="j" :class="p.cls" :style="p.style">{{ p.text }}</span></span>
          </div>
        </div>
      </div>
    </div>

    <button v-if="!following && unseen > 0" type="button" class="qd-log-resume" @click="resume">
      <i class="pi pi-arrow-down" /> {{ t('core.log.newLines', { count: unseen }) }}
    </button>
  </div>
</template>
