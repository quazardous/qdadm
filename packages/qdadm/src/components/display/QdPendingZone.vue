<script setup lang="ts">
/**
 * QdPendingZone - an area that waits for its data (#4665)
 *
 * A card, a section or a table whose data is being read:
 * - first read: a skeleton (or a spinner), never an empty area or a false state;
 * - failed: the error, readable, and Retry;
 * - read again: the content stays, dimmed, a small spinner in its corner.
 *
 * Usage:
 *   <QdPendingZone :read="backups" v-slot="{ data }"><BackupsTable :rows="data" /></QdPendingZone>
 *   <QdPendingZone :loading="loading" :error="error" variant="spinner" label="Reading the refs…">…</QdPendingZone>
 *
 * Slots: default (`{ data }`), `error` (`{ error, retry }`).
 */
import { computed } from 'vue'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import type { UseAsyncReadReturn } from '../../composables/useAsyncRead'

interface Props {
  /** A useAsyncRead(): everything comes from it */
  read?: UseAsyncReadReturn<unknown> | null
  /** Without `read`: a read is in flight */
  loading?: boolean
  /** Without `read`: why it failed */
  error?: string | null
  /** Without `read`: the data is there (default: not loading and no error) */
  ready?: boolean | null
  /** What shows during the first read */
  variant?: 'skeleton' | 'spinner'
  /** Skeleton lines */
  lines?: number
  /** What it waits for, under the spinner and for screen readers. Default "Reading…" */
  label?: string
  /** Least height while waiting, so the page does not jump */
  minHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  read: null,
  loading: false,
  error: null,
  ready: null,
  variant: 'skeleton',
  lines: 3,
  label: undefined,
  minHeight: undefined,
})

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()

const loading = computed(() => (props.read ? props.read.loading.value : props.loading))
const failure = computed(() => (props.read ? props.read.error.value : props.error))
const ready = computed(() => (props.read ? props.read.ready.value : (props.ready ?? (!props.loading && !props.error))))
const data = computed(() => props.read?.data.value)
const text = computed(() => props.label ?? t('core.pending.reading'))

/** The first read failed: nothing to show but the error */
const failed = computed(() => !ready.value && !loading.value && !!failure.value)

function retry(): void {
  emit('retry')
  void props.read?.load()
}

// Skeleton lines of slightly different lengths, as text would be
const widths = computed(() => Array.from({ length: Math.max(1, props.lines) }, (_, i) => `${[92, 78, 85, 64][i % 4]}%`))
</script>

<template>
  <div class="qd-pending-zone" :class="{ 'qd-pending-zone--reloading': ready && loading }" :aria-busy="loading ? 'true' : 'false'"
    :style="!ready && minHeight ? { minHeight } : undefined">
    <template v-if="ready">
      <div class="qd-pending-zone-content">
        <slot :data="data" />
      </div>
      <span v-if="loading" class="qd-pending-zone-corner" role="status" :aria-label="text">
        <i class="pi pi-spin pi-spinner qd-pending-spinner" aria-hidden="true" />
      </span>
      <div v-if="failure && !loading" class="qd-pending-zone-stale" role="alert">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        <span>{{ t('core.pending.failed', { error: failure }) }}</span>
        <QdButton :label="t('core.pending.retry')" icon="pi pi-refresh" size="small" text @click="retry" />
      </div>
    </template>
    <div v-else-if="failed" class="qd-pending-zone-error" role="alert">
      <slot name="error" :error="failure" :retry="retry">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        <span>{{ t('core.pending.failed', { error: failure }) }}</span>
        <QdButton :label="t('core.pending.retry')" icon="pi pi-refresh" size="small" outlined @click="retry" />
      </slot>
    </div>
    <div v-else-if="variant === 'spinner'" class="qd-pending-zone-spinner" role="status">
      <i class="pi pi-spin pi-spinner qd-pending-spinner" aria-hidden="true" />
      <span>{{ text }}</span>
    </div>
    <div v-else class="qd-pending-zone-skeleton" role="status" :aria-label="text">
      <span v-for="(w, i) in widths" :key="i" class="qd-pending-zone-line" :style="{ width: w }" />
    </div>
  </div>
</template>
