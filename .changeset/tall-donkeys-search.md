---
'@quazardous/qdadm': major
---

`vanilla-jsoneditor` is a real optional peer now — installing qdadm no longer drags in svelte

Every consumer inherited three `npm audit` advisories they could not resolve,
with **our package named** in their output, for a JSON editor most consoles
never open. Measured on a clean install of the packed tarball: a consumer now
gets no `vanilla-jsoneditor`, no `svelte`, and `npm audit` reports **0
vulnerabilities**.

Two declarations were wrong, in opposite directions:

- `vanilla-jsoneditor` sat in `optionalDependencies`, which npm installs **by
  default** — "optional" there only means "do not fail the install if it
  cannot be fetched". Everyone got it.
- It also had a `peerDependenciesMeta.optional` entry while not being a peer
  dependency at all, so the intent "optional peer" was written but never
  implemented.

It is now an optional `peerDependency`, where that meta entry finally takes
effect, matching the `/editors` subpath that was always opt-in.

**BREAKING in practice.** An app that imports `@quazardous/qdadm/editors`
without declaring `vanilla-jsoneditor` will fail to build after this upgrade.
That is the correct behaviour — it was depending on something it never asked
for — but it will not fail quietly:

```bash
npm install -D vanilla-jsoneditor
```

**The pin moves from `^0.23.0` to `^3.13.0`**, three majors on. That is what
clears the advisories: 0.23 pulls svelte 4 and its six XSS notices, 3.13 pulls
svelte 5 and is clean. The editor's own API changed with it —
`new JSONEditor(...)` is deprecated in favour of `createJSONEditor(...)` — and
qdadm's wrapper is migrated, so consumers using `VanillaJsonEditor` or
`JsonStructuredField` see no difference. Consumers calling the library
directly should read its 1.x/2.x/3.x notes.

Also fixed while in there: `peerDependenciesMeta.sass-embedded.optional` was
the **string** `"true"` rather than the boolean, so that optionality had never
applied either.
