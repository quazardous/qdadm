/**
 * qdadm/editors/yaml - YAML editors on @quazardous/vanilla-yamleditor (#4303)
 *
 * Import from '@quazardous/qdadm/editors/yaml' only if you install
 * @quazardous/vanilla-yamleditor (an optional peer): it stays out of the
 * main bundle and of '@quazardous/qdadm/editors/json'.
 *
 * import { VanillaYamlEditor, YamlConfigEditor, restYamlAdapter } from '@quazardous/qdadm/editors/yaml'
 *
 * Importing it also registers the YAML face of StructuredField (#5333).
 */
import '../components/editors/structured/registerYaml'

export { default as StructuredField } from '../components/editors/structured/StructuredField.vue'
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
// The rule builder (#5581): rules built by clicking, the YAML's comments kept
export { default as QdRuleBuilder } from '../components/editors/yaml/rules/QdRuleBuilder.vue'
export {
  vocabularyFromSchema,
  paramFromSchema,
  parseThreshold,
  formatThreshold,
  defaultParam,
  fitsParam,
  COMBINATORS,
  OPERATORS,
  type RuleVocabulary,
  type TermSpec,
  type ParamSpec,
  type ParamChoice,
  type Threshold,
  type Operator,
  type Combinator,
} from '../components/editors/yaml/rules/vocabulary'
export { moveItem, duplicateItem, addItemAt, addRule, removeAt, setAt, addKeyAt, renameKeyAt, setEnabled } from '../components/editors/yaml/rules/ruleDoc'
export type { YamlDocument, YamlPath } from '@quazardous/vanilla-yamleditor'
// The schema builder (#5587): the whole document built by clicking, its structure from its JSON Schema
export { default as QdSchemaBuilder } from '../components/editors/yaml/schema/QdSchemaBuilder.vue'
export { sectionsOf, fieldKind, conditionTypes, defaultFor, newItem, addListItem, resolverOf, type Section, type FieldKind } from '../components/editors/yaml/schema/schemaModel'
export type { SchemaHandlers } from '../components/editors/yaml/schema/context'
