/**
 * qdadm/editors/json - JSON editors on vanilla-jsoneditor (an optional peer)
 *
 * Import from '@quazardous/qdadm/editors/json' only if you install
 * vanilla-jsoneditor: it stays out of the main bundle. Importing it also
 * registers the JSON face of StructuredField (#5333).
 *
 * import { VanillaJsonEditor, JsonStructuredField } from '@quazardous/qdadm/editors/json'
 */
import '../components/editors/structured/registerJson'

export { default as VanillaJsonEditor } from '../components/editors/VanillaJsonEditor.vue'
export { default as JsonStructuredField } from '../components/editors/JsonStructuredField.vue'
export { default as StructuredField } from '../components/editors/structured/StructuredField.vue'

// Re-export the mode enum so consumers who want it don't need to depend on
// vanilla-jsoneditor directly (#1253). String literals ('tree' | 'text' |
// 'table') are accepted by VanillaJsonEditor's `mode` prop anyway.
export { Mode } from 'vanilla-jsoneditor'
