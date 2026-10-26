<script setup lang="ts">
/**
 * /editors/yaml surface (#4303): the YAML editors typecheck against the
 * published @quazardous/vanilla-yamleditor, an optional peer the fixture
 * asks for the way a consumer who chose them would.
 */
import { ref } from 'vue'
import { VanillaYamlEditor, YamlConfigEditor, restYamlAdapter, type JsonSchema, type YamlConfigAdapter } from '@quazardous/qdadm/editors/yaml'

const yaml = ref('a: 1\n')
const schema: JsonSchema = { type: 'object', properties: { a: { type: 'integer', minimum: 0 } } }
const adapter: YamlConfigAdapter = restYamlAdapter('/api/conf', { path: ['a'] })
</script>

<template>
  <VanillaYamlEditor v-model="yaml" :schema="schema" mode="tree" :problems="[{ path: 'a', message: 'no' }]" />
  <YamlConfigEditor :adapter="adapter" height="20rem" />
</template>
