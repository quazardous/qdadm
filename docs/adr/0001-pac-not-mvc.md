# 0001 — PAC, not MVC

**Status:** Accepted (backfilled 2026-08-20)

## Context

An admin framework's value is measured in how little a page has to say. The
usual Vue shape — a component that fetches, maps, validates and renders — puts
logic in the view, which means every page re-implements the same CRUD plumbing
and every page needs its own test.

MVC doesn't fix this: it allows the view to reach into the model, so logic
leaks back into components as soon as a screen gets non-trivial.

## Decision

qdadm follows **PAC** (Presentation-Abstraction-Control):

- **Presentation** — pages and components are dumb. They compose and bind. No
  fetching, no mapping, no business rules. `v-if` / `v-for` carrying logic is
  treated as a smell.
- **Abstraction** — `EntityManager` holds the domain: CRUD, permissions, cache,
  relations. See [ADR 0002](0002-entitymanager-centric-domain.md).
- **Control** — the kernel and orchestrator wire everything once at boot.

The layers are isolated, not merely layered: a page knows entity *names* and
builders, never a storage class or an HTTP client.

## Consequences

- A full CRUD list page is ~20 lines, a form page ~40. The density is a
  structural property, not a template trick — `examples/hello-world` and the
  tutorial app hold the claim honest.
- Tests concentrate on the abstraction layer, where the logic is. Views are
  trivial enough that testing them adds little.
- Swapping a storage backend requires zero page changes.
- The cost lands on customisation: anything a page wants to do differently has
  to be reachable through configuration, slots, hooks or zones, because writing
  it inline in the page would break the pattern. That is why qdadm carries as
  much extension machinery as it does — progressive customisation is the price
  of dumb presentation, and each escape hatch has to exist deliberately rather
  than being improvised per page.
- Contributors arriving from a MVC-shaped Vue codebase will reach for the
  component first. Reviews push logic down into the manager.
