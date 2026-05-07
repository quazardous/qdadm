/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Style modules. The `vite/client` triple-slash above already declares these,
// but consumers running `vue-tsc --noEmit` on qdadm's source may not always
// resolve `vite/client` (qdadm doesn't ship vite as a hard dep, and consumer
// tsconfigs sometimes scope `compilerOptions.types` narrowly). Declaring them
// here directly makes qdadm's type surface self-sufficient — the scss imports
// in DebugModule, NotificationModule, and Module.styles() type-check from any
// downstream context.
declare module '*.scss' {
  const content: string
  export default content
}

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.sass' {
  const content: string
  export default content
}

// `pluralize` ships as plain JS without bundled `.d.ts`. The official
// types live in `@types/pluralize` but pulling them in as a runtime
// dep here is overkill for a single-call usage. Declare the minimum
// surface we use so `strict` mode is happy without DefinitelyTyped.
declare module 'pluralize' {
  interface PluralizeFn {
    (word: string, count?: number, inclusive?: boolean): string
    singular(word: string): string
    plural(word: string, count?: number, inclusive?: boolean): string
    isPlural(word: string): boolean
    isSingular(word: string): boolean
  }
  const pluralize: PluralizeFn
  export default pluralize
}
