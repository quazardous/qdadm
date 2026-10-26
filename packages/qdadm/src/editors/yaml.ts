/**
 * qdadm/editors/yaml - YAML editors on @quazardous/vanilla-yamleditor (#4303)
 *
 * Import from '@quazardous/qdadm/editors/yaml' only if you install
 * @quazardous/vanilla-yamleditor (an optional peer): it stays out of the
 * main bundle and of '@quazardous/qdadm/editors'.
 *
 * import { VanillaYamlEditor, YamlConfigEditor, restYamlAdapter } from '@quazardous/qdadm/editors/yaml'
 */
export { default as VanillaYamlEditor } from '../components/editors/yaml/VanillaYamlEditor.vue'
export { default as YamlConfigEditor } from '../components/editors/yaml/YamlConfigEditor.vue'
export {
  restYamlAdapter,
  normalizeProblems,
  normalizeProblemPath,
  YamlConflictError,
  type RestYamlAdapterOptions,
  type YamlConfigAdapter,
  type YamlConfigDocument,
  type YamlHistoryEntry,
  type YamlRevision,
  type YamlSaveInput,
} from '../components/editors/yaml/yamlConfigAdapter'
export type { JsonSchema, YamlProblem, YamlProblemInput, YamlEditorMode, YamlEditorStatus } from '@quazardous/vanilla-yamleditor'
