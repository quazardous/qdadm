---
'@quazardous/qdadm': patch
---

A filter type qdadm cannot render now says so — at compile time and at runtime

Reported by a consumer who declared `type: 'text'` on two filters. `ListPage`
is binary — an autocomplete, or a `Select` for everything else, unknown types
included — so both rendered as dropdowns with no options, read **"No available
options"**, and users concluded there was nothing to choose. They had never
filtered anything since the day they were written.

Two holes, and the second is larger than the report:

**Nothing warned.** `addFilter` now does, naming the filter, the type, and
what will happen *instead* — because three screens later there is only an
empty control and no way back to the declaration that caused it.

**Nothing failed to compile either, and not just for `type`.** `addFilter`
took `Omit<FilterConfig, 'name'>`; `FilterConfig` carries an index signature,
so `keyof` includes `string`, `Exclude<string, 'name'>` is still `string`, and
the `Omit` collapsed to a bare `{ [x: string]: unknown }` — **erasing every
declared property**. No filter option was type-checked at all: not `type`, not
`optionLabel`, not a misspelled `local_filter`.

Fixed by splitting the interface — `FilterOptions` declares the properties,
`FilterConfig extends FilterOptions` adds `name` — so nothing needs `Omit` and
the index signature stops eating the declarations. Apps can still stash their
own keys.

**`FILTER_TYPES` is exported as a value**, so a guard on your side can read the
list rather than copy it; a copy goes stale the day a type is added and starts
rejecting correct code.

Also new: `tsconfig.typetest.json`, because the type-level test that asserts
all this sat under `tests/` and the type-check config included `src/**` only —
so its `@ts-expect-error` directives were never read and it would have passed
with the bug back in place. It is now in front of the checker and verified to
go red when the collapse returns.
