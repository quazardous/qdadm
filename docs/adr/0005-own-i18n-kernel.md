# 0005 — Own i18n kernel instead of vue-i18n

**Status:** Accepted (backfilled 2026-08-20)

## Context

vue-i18n is the default answer for translating a Vue app. It expects
hand-written keys: the developer writes `t('books.fields.title')` and maintains
a message catalogue in parallel with the code.

For an admin framework that already knows every entity, every field and every
action declaratively ([ADR 0002](0002-entitymanager-centric-domain.md)), that
duplicates information the framework holds. Surveyed admin frameworks
(react-admin, Refine, AdminJS, AdminForth) all require the hand-written keys.

The other constraint: most qdadm apps are single-language. Whatever i18n exists
must cost nothing to the projects that never turn it on.

## Decision

Ship a small i18n kernel inside qdadm rather than depending on vue-i18n.

- **The schema is the key source.** Keys are derived from module / entity /
  field names; nobody writes `t('...')` in a field config. Providers only supply
  translations for keys the framework already knows.
- **Providers are pluggable** — inline, lazy, incremental-by-domain. Pages never
  see them.
- **Locale changes travel on the signal bus**, not through an imported
  singleton.
- Missing keys fall back to a humanised field name, so an untranslated app is
  a working app.

## Consequences

- Adding a language to an existing admin is mostly supplying a catalogue; the
  keys already exist and can be dumped from the running app
  (`asJsonSkeleton` on the i18n collector).
- Skipping i18n is free: no catalogue, no setup, humanised labels.
- qdadm owns pluralisation, interpolation and locale-negotiation code that
  vue-i18n would have provided. The surface is deliberately small — this is not
  a general-purpose i18n library and should not grow into one.
- Consumers already standardised on vue-i18n for their non-admin screens run
  two systems. They coexist (nothing is global), but the framework chrome is
  translated by qdadm's kernel.
- The framework's own strings live in a built-in core bundle, which is what
  lets an app with no i18n configuration still render sensible buttons.
