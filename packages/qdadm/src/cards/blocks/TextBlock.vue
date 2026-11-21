<script setup lang="ts">
/** text block (#5414): a short text, its tone, a word in bold after it */
import type { TextBlock } from './types'
import type { CardSize } from '../types'

defineProps<{ block: TextBlock; size: CardSize }>()
</script>

<template>
  <p
    class="qd-card-block"
    :class="[block.look === 'reading' ? 'qd-trend-reading' : 'qd-card-note', block.tone ? `qd-tone-text--${block.tone}` : null]"
    data-block="text"
  >
    {{ block.text }}<template v-if="block.strong">
      <strong class="qd-card-note-strong">{{ block.strong }}</strong></template
    >
  </p>
</template>
