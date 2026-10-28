<script setup>
/**
 * YamlConfigPlayground — a live YAML configuration, edited end to end (#4303).
 */
import { ref } from 'vue'
import { usePageTitle } from '@quazardous/qdadm'
import { YamlConfigEditor } from '@quazardous/qdadm/editors/yaml'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { fakeYamlAdapter, someoneElseSaves, resetYamlConfig } from '../fakeYamlConfig'

usePageTitle('YAML config')

const editor = ref(null)
const key = ref(0)

function reset() {
  resetYamlConfig()
  key.value++
}
</script>

<template>
  <div class="yaml-config-playground">
    <Card>
      <template #title>Availability filters</template>
      <template #content>
        <p class="hint">
          Edit in the form, the tree or the text: comments and formatting stay as written. Saving runs the server's check
          (a store channel needs a SKU), shows the diff and asks for a reason. The history keeps every save.
        </p>
        <div class="actions">
          <Button label="Someone else saves" icon="pi pi-user-edit" severity="secondary" outlined size="small" @click="someoneElseSaves" />
          <Button label="Reset the demo" icon="pi pi-refresh" severity="secondary" text size="small" @click="reset" />
        </div>
        <YamlConfigEditor :key="key" ref="editor" :adapter="fakeYamlAdapter" height="30rem" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.hint {
  margin-top: 0;
  color: var(--p-text-muted-color);
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
</style>
