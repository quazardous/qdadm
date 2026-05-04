/**
 * Ambient declarations for Vite/Vitest `?raw` imports of arbitrary text
 * files (YAML, etc.). Lets `import yamlText from './foo.yml?raw'` type-check
 * without per-call casts.
 */

declare module '*.yml?raw' {
  const content: string
  export default content
}

declare module '*.yaml?raw' {
  const content: string
  export default content
}
