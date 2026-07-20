<script setup lang="ts">
/**
 * QdMessage — the single indirection point over the widget library's Message
 * (#1391 exit-readiness). Generic pass-through, same contract as QdButton.
 */
import Message from 'primevue/message'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Message v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </Message>
</template>
