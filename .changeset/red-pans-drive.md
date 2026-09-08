---
'@quazardous/qdadm': major
---

Five Kernel registries now exist the moment the Kernel does

Seventeen public `Kernel` properties were `null` until `createApp()`, through
a window nothing documented. Someone wired `kernel.signals` right after
`new Kernel()`, got `null`, and `null?.emit?.()` swallowed it without a word.

Five of them had no reason to wait — they depend on nothing but `options` and
each other — and are now built in the constructor: `signals`, `hookRegistry`,
`zoneRegistry`, `deferred`, `permissionRegistry`. Every creator is idempotent,
so the calls still made during `createApp()` keep these instances rather than
orphaning whatever was registered on them in between.

**Their types drop `| null`.** That is the breaking part, and it is the point:
the contract stops advertising a danger that no longer exists. Code written as
`kernel.signals?.emit(...)` keeps working — optional chaining on a non-null
value is merely redundant — but a consumer whose types said `SignalBus | null`
and who branched on it will find that branch unreachable. `strictNullChecks`
users may see narrowing they relied on disappear.

Closing the window beats warning about it: this removes defensive code rather
than adding any. `_setupSecurity` no longer rebuilds a registry that might be
missing, and `_createDeferredRegistry` no longer reaches through `?.` for a
bus that is always there.

The properties that genuinely cannot exist before the app is mounted —
`vueApp`, `router`, `moduleLoader`, `orchestrator` and the rest — are
untouched. They are a different problem: the answer there is to refuse the
read with a message naming the moment, not to fake a value.
