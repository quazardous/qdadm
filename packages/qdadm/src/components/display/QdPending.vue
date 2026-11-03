<script setup lang="ts">
/**
 * QdPending - a badge that waits for its value (#4665)
 *
 * Until the value is read, a neutral tag with a spinner and a short label
 * stands in for the badge: never an empty spot, never a false state. Once it
 * arrives (null included), the slot shows. A failed read shows a muted
 * "unavailable" tag, the error in its tooltip: never a warning colour.
 *
 * Usage:
 *   <QdPending :value="code" label="Reading the deployed code…"><Tag :value="code.state" /></QdPending>
 *   <QdPending :read="codeRead" v-slot="{ value }"><Tag :value="value.state" /></QdPending>
 */
import { computed } from 'vue'
import Tag from 'primevue/tag'
import { useI18n } from '../../i18n/useI18n'
import type { UseAsyncReadReturn } from '../../composables/useAsyncRead'

interface Props {
  /** The value; `undefined` means not read yet */
  value?: unknown
  /** A useAsyncRead(): waits on `ready`, shows its `error` */
  read?: UseAsyncReadReturn<unknown> | null
  /** What it waits for. Default "Reading…" */
  label?: string
  /** Why the read failed, without `read` */
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), { value: undefined, read: null, label: undefined, error: null })

const { t } = useI18n()

const arrived = computed(() => (props.read ? props.read.ready.value : props.value !== undefined))
const current = computed(() => (props.read ? props.read.data.value : props.value))
// A retry in flight waits again, rather than still saying it failed
const failure = computed(() => (props.read ? (props.read.loading.value ? null : props.read.error.value) : props.error))
</script>

<template>
  <slot v-if="arrived" :value="current" />
  <Tag v-else-if="failure" class="qd-pending qd-pending--failed" severity="secondary" role="status" :title="failure"
    :aria-label="`${t('core.pending.unavailable')}: ${failure}`">
    <i class="pi pi-minus-circle" aria-hidden="true" />
    <span>{{ t('core.pending.unavailable') }}</span>
  </Tag>
  <Tag v-else class="qd-pending" severity="secondary" role="status" aria-busy="true">
    <i class="pi pi-spin pi-spinner qd-pending-spinner" aria-hidden="true" />
    <span>{{ label ?? t('core.pending.reading') }}</span>
  </Tag>
</template>
