<script setup lang="ts">
/** An html block (#5445): sanitised */
import { ref, watchEffect } from 'vue'
import { sanitizeHtml } from './render'
import { useRichPending } from './context'
import type { RichDialogBlock } from './types'

const props = defineProps<{ block: RichDialogBlock }>()
const html = ref('')
// The dialog waits for the first rendering before it counts the content as read
const done = useRichPending()
watchEffect(async () => {
  html.value = await sanitizeHtml(String(props.block.source ?? ''))
  done()
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised by DOMPurify -->
  <div class="qd-rich-prose" data-rich-html v-html="html"></div>
</template>
