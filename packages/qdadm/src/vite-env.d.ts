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
