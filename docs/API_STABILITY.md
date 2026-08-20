# API stability

qdadm exports a lot: 15 entry points, ~50 components, ~40 composables. Not all
of it is equally settled, and pretending otherwise helps nobody — an
undifferentiated surface either freezes everything or makes every version
risky.

This page says which parts you can build on, and what a change to each costs.

## How the tiers are decided

The stable tier is not a curated list — curated lists drift. It is defined
**operationally**, by what CI compiles on every push to `main`:

> **Stable = what `tools/consumer-smoke/fixture/` and the tutorial exercise.**

That fixture is a strict-TypeScript app installed from the *packed tarball* and
typechecked with `vue-tsc`. If a stable signature regresses, the release fails
before it publishes. See
[ADR 0006](adr/0006-consumer-smoke-as-stability-contract.md) for why the
contract is drawn this way.

Everything else falls into one of two tiers below it, by whether it is
documented and exercised by the demo, or still moving.

| Tier | Definition | Breaking it costs |
|---|---|---|
| **Stable** | Exercised by the consumer-smoke fixture or the tutorial. CI-enforced. | A major |
| **Supported** | Documented in `docs/` and exercised by the demo, but not pinned by the fixture. | A minor + a CHANGELOG entry |
| **Experimental** | Marked `@experimental` on its module entry point. | A minor, no notice |

## Stable

The patterns below are pinned by `tools/consumer-smoke/fixture/src/` — the
files are worth reading, they are the contract in executable form.

**Bootstrap and modules** — `Kernel`, `KernelOptions`, `Module`,
`KernelContext`, and the registration calls the tutorial uses: `ctx.entity()`,
`ctx.crud()`.

**Domain layer** — `EntityManager` (including subclassing and narrowing through
`QdadmManagerRegistry`), `EntityManagerRead`, `EntityRecord`, the `fields`
schema, the `parents` / `children` / `reference` relation shapes,
`resolveStorage()` overrides and `StorageResolution`.

**Storage and auth** — `MockApiStorage`, `ApiStorage`,
`LocalStorageSessionAuthAdapter` (including subclassing it and the
`entityAuthAdapter: () => adapter.getUser()` function form).

**Page builders and components** — `useEntity`, `useOrchestrator`,
`useListPage` (including `column()`), `useEntityItemFormPage`,
`useEntityItemShowPage`, and the components they bind to: `FormPage`,
`FormField`, `FormInput`, `ShowPage`, `ShowField`. The documented wiring
(`v-bind="builder.props.value" v-on="builder.events"`) is part of the contract.
So are `ButtonSeverity` and `ShowActionConfig`.

**Subpath entry points** — `@quazardous/qdadm/gen` (`generateManagers`,
`OpenAPIConnector`), `/security` (`createLocalStorageRolesProvider`),
`/utils` (`humanizeFieldName`, `formatFetchError`), `/editors`
(`VanillaJsonEditor`, `JsonStructuredField`, `Mode`), and the `/styles`
side-effect import with its types condition.

## Supported

Documented, demo-exercised, not fixture-pinned. Safe to build on; a breaking
change gets a minor and a CHANGELOG entry rather than silence.

| Area | Docs |
|---|---|
| Signals | [signals.md](signals.md) |
| Hooks | [hooks.md](hooks.md) |
| Zones (`ctx.zone()`, `ctx.block()`, `Zone`) | [zones.md](zones.md) |
| Security beyond the bootstrap helper — `SecurityChecker`, roles, wildcard permissions | [security.md](security.md) |
| i18n — providers, strategies, `useI18n` | [i18n.md](i18n.md) |
| Field widgets — `LookupField`, `KeyValueEditor`, `ScopeEditor`, `PermissionEditor`, … | [forms.md](forms.md) |
| Non-entity forms — `useBareForm` | [forms.md](forms.md) |
| Module extension and manager decorators — `extendModule`, `createDecoratedManager` | [extension.md](extension.md) |
| Notifications — `useNotifications`, `NotificationModule` | [AGENT_GUIDE.md](AGENT_GUIDE.md) |
| Debug bridge and collectors — `@quazardous/qdadm/modules/debug` | [DEBUG.md](DEBUG.md), [AGENTS.md](../AGENTS.md) |
| Vite plugins — `qdadmVitePlugin`, `qdadmDebugPlugin` | [README](../README.md) |
| Layout components — `AppLayout`, `PageLayout`, `ListPage` | [crud.md](crud.md), [page-compositions.md](page-compositions.md) |

To promote something from here to stable, add the pattern to the fixture. That
is the whole procedure — nothing becomes stable by accident.

## Experimental

Marked `@experimental` in the source, on the module entry point. These may
change shape in a minor release without a deprecation cycle.

| Entry point | What it is | Why it is not settled |
|---|---|---|
| `src/chain/` | `ActiveStack`, `StackHydrator` and their composables — the navigation stack | Internal plumbing for parent/child routing that happens to be exported; the level shape is still moving |
| `src/deferred/` | `DeferredRegistry` — named promises for loose async coupling | One consumer pattern, no downstream usage to validate the shape |
| `src/query/` | `QueryExecutor`, `FilterQuery` — the classes | Direct use only. The **query object syntax** they interpret (`{ field: { $in: [...] } }`) is stable — it is what list filters and `EntityManager.query()` speak |
| `src/kernel/SSEBridge.ts` | Server-sent-events bridge (re-exported from qdcore) | Signal-mapping and reconnection options still moving |
| `src/gen/vite-plugin.ts` | `qdadmGen` — codegen in the Vite build pipeline | Undocumented; the programmatic `generateManagers` entry is the stable one |

Using an experimental API is fine — it is exported, it works, and the demo or
the framework itself often depends on it. Just pin your qdadm version, or be
ready for a small edit on a minor bump.

## What is not public at all

Anything not reachable through the `exports` map in
`packages/qdadm/package.json` is internal, regardless of whether TypeScript
lets you deep-import it. Deep imports into `src/` are not covered by any tier.

## For contributors

Before changing a public signature, find its tier. Stable means the fixture has
to change with it, which is the point where you ask whether the break is worth
a major. See [CONTRIBUTING.md](../CONTRIBUTING.md).
