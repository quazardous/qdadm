---
'@quazardous/qdadm': minor
---

`./gen`'s runtime factory is renamed `createGeneratedManagers` — it collided with the root's own `createManagers`

Two public entry points exported the same name for different functions. The
root's `createManagers` takes `(config, context)` and returns a plain object;
`./gen`'s took a single generated config and returned a `Map`. Whoever reached
for the wrong import got no warning at all — the mistake surfaced at the first
`.get()`, several frames from its cause.

The documentation had absorbed the confusion too: `docs/gen.md` showed the
ROOT's signature under the `./gen` import, and promised a `Record` where a
`Map` comes back. Corrected.

Nothing breaks: `createManagers` is still exported from `./gen` as a
deprecated alias. New code should use `createGeneratedManagers`.

This is the naming half of the problem only. `./gen` remains a source entry
that Node cannot load on its own — splitting the build-time codegen from the
runtime factory is a larger change with, so far, no one asking for it.
