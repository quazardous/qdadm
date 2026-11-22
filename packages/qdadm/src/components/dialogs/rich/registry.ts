/**
 * The rich dialog's handlers (#5445): a block's `kind` names its content
 * handler, a control's `kind` its control handler. qdadm's own are
 * registered here; an app adds its own, as it does cards and charts.
 */
import { markRaw, type Component } from 'vue'
import TextContent from './TextContent.vue'
import MarkdownContent from './MarkdownContent.vue'
import HtmlContent from './HtmlContent.vue'
import ToggleControl from './ToggleControl.vue'
import CheckboxControl from './CheckboxControl.vue'

const BUILTIN_CONTENT: Record<string, Component> = { text: TextContent, markdown: MarkdownContent, html: HtmlContent }
const BUILTIN_CONTROLS: Record<string, Component> = { toggle: ToggleControl, checkbox: CheckboxControl }

const contents = new Map<string, Component>()
const controls = new Map<string, Component>()

function register(map: Map<string, Component>, builtin: Record<string, Component>, what: string, kind: string, component: Component): void {
  if (!kind) throw new Error(`[qdadm] ${what}: a handler needs a kind`)
  if (kind in builtin) throw new Error(`[qdadm] ${what}('${kind}'): qdadm draws '${kind}' itself; give yours another kind ('myapp.${kind}')`)
  if (map.has(kind)) console.warn(`[qdadm] ${what}('${kind}'): replaces the handler already registered`)
  map.set(kind, markRaw(component))
}

/** A block of `kind` is drawn by this component, given `block` */
export function registerDialogContent(kind: string, component: Component): void {
  register(contents, BUILTIN_CONTENT, 'registerDialogContent', kind, component)
}

/** A control of `kind` is drawn by this component, given `control`, `modelValue` and `read`; it emits `update:modelValue` */
export function registerDialogControl(kind: string, component: Component): void {
  register(controls, BUILTIN_CONTROLS, 'registerDialogControl', kind, component)
}

export function getDialogContent(kind: string): Component | null {
  return BUILTIN_CONTENT[kind] ?? contents.get(kind) ?? null
}

export function getDialogControl(kind: string): Component | null {
  return BUILTIN_CONTROLS[kind] ?? controls.get(kind) ?? null
}

/** Tests only */
export function resetDialogHandlers(): void {
  contents.clear()
  controls.clear()
}
