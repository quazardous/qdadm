<script setup lang="ts">
/** A text block (#5445): paragraphs on blank lines, escaped */
import { computed } from 'vue'
import type { RichDialogBlock } from './types'

const props = defineProps<{ block: RichDialogBlock }>()
const paragraphs = computed(() => String(props.block.text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean))
</script>

<template>
  <div class="qd-rich-text">
    <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
  </div>
</template>
