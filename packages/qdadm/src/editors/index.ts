/**
 * qdadm/editors - Optional editors that require vanilla-jsoneditor
 *
 * Import from '@quazardous/qdadm/editors' only if you need VanillaJsonEditor.
 * This keeps vanilla-jsoneditor out of the main bundle.
 *
 * Usage:
 * import { VanillaJsonEditor, JsonStructuredField } from '@quazardous/qdadm/editors'
 */

export { default as VanillaJsonEditor } from '../components/editors/VanillaJsonEditor.vue'
export { default as JsonStructuredField } from '../components/editors/JsonStructuredField.vue'

// Re-export the mode enum so consumers who want it don't need to depend on
// vanilla-jsoneditor directly (#1253). String literals ('tree' | 'text' |
// 'table') are accepted by VanillaJsonEditor's `mode` prop anyway.
export { Mode } from 'vanilla-jsoneditor'
