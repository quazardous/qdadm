<script setup lang="ts">
/**
 * QdRichDialogHost (#5445): shows the queue of `useRichDialog().open()`, one
 * dialog at a time. Mounted once by the kernel (and by `<QdadmRoot />`).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import QdRichDialog from './QdRichDialog.vue'
import { registerRichDialogHost, richDialogQueue, settleRichDialog } from './useRichDialog'
import type { RichDialogResult } from './types'

const unregister = registerRichDialogHost()
onBeforeUnmount(unregister)

const current = computed(() => richDialogQueue[0] ?? null)
const visible = ref(false)
watch(current, (c) => (visible.value = !!c), { immediate: true })

let answer: RichDialogResult | null = null
function onAnswer(r: RichDialogResult): void {
  answer = r
}
// Once hidden, the answer goes back and the next dialog shows
function onVisible(v: boolean): void {
  visible.value = v
  if (v || !current.value) return
  const id = current.value.id
  const r = answer ?? { action: null, values: {} }
  answer = null
  settleRichDialog(id, r)
}
</script>

<template>
  <QdRichDialog
    v-if="current"
    :key="current.id"
    :visible="visible"
    :title="current.options.title"
    :icon="current.options.icon"
    :width="current.options.width"
    :max-height="current.options.maxHeight"
    :blocks="current.options.blocks"
    :actions="current.options.actions"
    :controls="current.options.controls"
    :read-to-end="current.options.readToEnd"
    :dismissable="current.options.dismissable ?? true"
    data-rich-host
    @action="onAnswer"
    @close="onAnswer"
    @update:visible="onVisible"
  >
    <template v-if="current.options.footer" #footer="p">
      <component :is="current.options.footer" v-bind="p" />
    </template>
  </QdRichDialog>
</template>
