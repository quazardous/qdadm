# 0002 — EntityManager as the single domain layer

**Status:** Accepted (backfilled 2026-08-20)

## Context

[ADR 0001](0001-pac-not-mvc.md) requires domain logic to live outside the view.
That leaves the question of *where*. Candidates were a store-per-entity
(Pinia modules), a service layer of loose functions, or a single object per
entity owning everything.

Stores fragment the domain across state, getters and actions and tempt pages
into reading raw state. Loose services give no obvious home for permissions and
caching, which then get re-implemented per screen.

## Decision

One class — `EntityManager` — is the domain layer for an entity. It owns:

- **CRUD** against a pluggable storage adapter,
- **permissions** (`canRead` / `canCreate` / `canUpdate` / `canDelete`),
- **cache** and invalidation,
- **relations** (`parents`, `children`, field-level `reference`),
- **field schema**, from which labels, list columns, form fields and i18n keys
  are derived.

Entities are declared, not coded: a manager is usually an `EntityManager`
instance configured with a `fields` map. Subclassing is the escape hatch when
an entity needs real behaviour, and the registry (`QdadmManagerRegistry`) lets
a consumer type its own subclass so `useEntity('bots')` returns the narrowed
type.

Pages reach managers only through the orchestrator and the page builders
(`useListPage`, `useEntityItemFormPage`, `useEntityItemShowPage`).

## Consequences

- The field schema becomes the single source of truth for the whole vertical
  slice — UI labels, validation, list columns and translation keys all derive
  from it, which is what makes [ADR 0005](0005-own-i18n-kernel.md) possible.
- OpenAPI codegen has an obvious target: generate manager declarations.
- Permission checks are enforced in one place instead of being scattered across
  buttons and route guards.
- `EntityManager` is a large class, and that concentration is deliberate — but
  it makes the file a hotspot and a merge-conflict magnet. Structural views
  (`EntityManagerRead`) exist so consumers can implement the minimum without
  inheriting the whole surface.
- Anything genuinely not entity-shaped (a dashboard, a wizard) sits outside this
  model and uses `useBareForm` or a plain custom route.
