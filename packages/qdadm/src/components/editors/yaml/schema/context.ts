/**
 * What the schema builder's parts share (#5587): the patch to apply, the root
 * schema (its refs), the app's handlers, read-only, and « Edit in the text ».
 */
import { inject, provide, type Component, type InjectionKey } from 'vue'
import type { YamlPath } from '@quazardous/vanilla-yamleditor'

/** A handler: an app's widget for an `x-widget` property */
export type SchemaHandlers = Record<string, Component>

export interface SchemaBuilderContext {
  apply: (change: (text: string) => string) => void
  root: () => unknown
  handlers: () => SchemaHandlers
  readOnly: () => boolean
  reveal: (path: YamlPath) => void
}

const KEY: InjectionKey<SchemaBuilderContext> = Symbol('qd-schema-builder')
export const provideSchemaBuilder = (ctx: SchemaBuilderContext): void => provide(KEY, ctx)
export function useSchemaBuilder(): SchemaBuilderContext {
  const ctx = inject(KEY, null)
  if (!ctx) throw new Error('QdSchemaBuilder parts are drawn inside QdSchemaBuilder')
  return ctx
}
