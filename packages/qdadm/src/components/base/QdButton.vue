<script setup lang="ts">
/**
 * QdButton — the single indirection point over the widget library's Button
 * (#1391 exit-readiness). Generic pass-through: every attr/prop/listener and
 * every slot is forwarded verbatim, so swapping or shimming the underlying
 * widget is a one-file change. Imports `primevue/button`, which the
 * qdadmVitePlugin flavor alias (#1393) traverses.
 */
import Button from 'primevue/button'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Button v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </Button>
</template>
