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
