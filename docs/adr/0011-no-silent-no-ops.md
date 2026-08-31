# 0011 — A no-op must be an exception, never a default

**Status:** Accepted (2026-08-31)

## Context

In a single day, one consumer hit four separate cases where a qdadm mechanism
was **correct** and simply never activated. None of them produced an error, a
warning, or a visible symptom.

| What the consumer wrote | What happened | What they heard |
|---|---|---|
| `debugBar: { enabled: false }` | the bar rendered anyway — **in production** | nothing |
| `sse: { getToken }` on a version predating the key | ignored, and the **durable session token went into the URL** | nothing |
| a non-axios storage received a 401 | `auth:expired` never emitted, expiry never detected | nothing |
| `kernel.signals` read before `createApp()` | `null`; `null?.emit?.()` does not throw | nothing |

The cost was not theoretical: a debug bar in production, an authentication
token in access logs, and a screen stacking one error toast per request
against a dead session.

Their diagnosis is the one worth keeping:

> The common thread is not code quality — it is that a missing connection or
> an unknown key produces **no noise at all**.

Two properties of our stack make this the default rather than the accident.
JavaScript swallows the mistake — `null?.x?.()` is silent, an unknown object
key is simply absent — and a framework that accepts a configuration object
accepts *any* object. Neither is unusual. Together they mean that not wiring
something looks exactly like wiring it correctly.

The scale, measured while writing this: **`sse` is the only configuration
whose keys are validated** — the other ~31 kernel options accept anything.
And **seventeen public kernel properties are `null` until `createApp()`**,
`signals` being merely the one someone happened to trip over.

## Decision

**A silent no-op is a defect, not a neutral outcome.** When a configuration
does not apply, or a mechanism is not wired, qdadm says so.

Three responses, in order of preference. Prefer the earliest that applies:

1. **Make the case impossible.** Creating the signal bus in the constructor
   removes the `null` window entirely; that beats any warning about it. A trap
   that no longer exists needs no documentation and cannot be forgotten.
2. **Make noise in dev, naming what happens INSTEAD.** Not merely that a key
   was ignored — *"ignored"* reads as *"no effect"*, when in the `sse.getToken`
   case it meant *"falls back to a more sensitive secret"*. That reading is
   what turned a typo into an incident, so the consequence is the part that
   must be said.
3. **Document the connection as an obligation**, not as a note. Last resort:
   documentation that a mechanism's correctness depends on is documentation
   someone will not read.

### Applies to

- **Configuration objects** — validate the keys, warn on the unrecognised
  ones, and say what the absence costs.
- **Extension points that assume wiring** — if a signal has exactly one
  emitter and consumers can replace that emitter's transport, the mechanism is
  optional in practice and must announce it.
- **Public properties with a null window** — either close the window or refuse
  the read; never return `null` and let the caller's optional chaining hide it.

## Consequences

- New warnings appear for configurations that were previously accepted in
  silence. Some are typos that had been quietly broken for a long time —
  finding them is the point, and it will be noisy the first time.
- Naming the consequence costs more than naming the omission: the code has to
  know what the fallback does. That knowledge is worth having explicit.
- Warnings are a dev-mode tool. They must not fire in production, and they
  must not become the primary answer — option 1 is always better, and reaching
  for a warning is a sign the design could have made the case impossible.
- A warning nobody reads is worse than none: it teaches people to skip the
  console. Warn on what is *wrong*, not on what is merely unusual.
- This rule is retroactive in intent but incremental in practice: the audit is
  the work, not a rewrite. Highest damage first.

## Not a rule about validation

This is not "validate everything". A framework that rejects every unexpected
key is hostile to extension, and qdadm deliberately accepts unknown module
options. The rule is narrower: **wherever qdadm would otherwise do nothing and
say nothing, it must say something** — and what it says is what happens
instead.
