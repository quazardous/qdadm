---
"@quazardous/qdadm": patch
---

Fix codegen class-mode constructor TS2345 on `fields`. The generated `Generated${X}Manager` constructor was typing its `options` argument as a hand-rolled `Partial<{ ... fields: Record<string, unknown>; [key: string]: unknown }>`. The toxic combo (`Record<string, unknown>` + index signature) widened the inline literal's strictly-typed `fields: Record<string, FieldConfig>` at the `super({ ...literal, ...options })` spread, so `vue-tsc --noEmit` against generated files reported `TS2345: Argument of type '{ ...; fields: Record<string, unknown>; ... }' is not assignable to parameter of type 'EntityManagerOptions<XxxEntity>'`.

The codegen now emits `constructor(options: Partial<EntityManagerOptions<${className}Entity>> = {})` and imports `EntityManagerOptions` from `@quazardous/qdadm`. The signature stays in sync with the parent class automatically — future additions to `EntityManagerOptions` no longer require touching the template — and the strict `fields` typing survives the spread. Reported by skybot-claude on `vue-tsc --noEmit` over generated managers in 1.19.4.
