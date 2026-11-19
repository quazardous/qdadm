/**
 * The raw faces of StructuredField (#5333): JSON or YAML, each behind the
 * entry of its optional peer.
 *
 * StructuredField imports no editor: importing `@quazardous/qdadm/editors/json`
 * registers the JSON face, `@quazardous/qdadm/editors/yaml` the YAML one. A
 * format asked for without its entry is said once, with the import to add.
 */
import { markRaw, type Component } from 'vue'

export type StructuredFormat = 'json' | 'yaml'

/**
 * A raw face is a component that edits the value as text:
 * - props: `modelValue` (the value), `height`, `options` (the format's own, e.g. JSON `mode`)
 * - emits: `update:modelValue` with each valid value, `invalid` with true / false
 */
const faces = new Map<StructuredFormat, Component>()
const warned = new Set<StructuredFormat>()

export function registerStructuredFace(format: StructuredFormat, component: Component): void {
  faces.set(format, markRaw(component))
}

export function getStructuredFace(format: StructuredFormat): Component | null {
  const face = faces.get(format)
  if (!face && !warned.has(format)) {
    warned.add(format)
    console.warn(
      `[qdadm] StructuredField: no ${format.toUpperCase()} face. Import '@quazardous/qdadm/editors/${format}' once in the app ` +
        `(it needs ${format === 'json' ? 'vanilla-jsoneditor' : '@quazardous/vanilla-yamleditor'}).`
    )
  }
  return face ?? null
}
