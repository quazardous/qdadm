---
"@quazardous/qdadm": minor
---

OpenAPIConnector now warns on contract-less object schemas (#1240). A consumed
`type: 'object'` node with no `properties`, no `additionalProperties` and no
`$ref`/`oneOf`/`anyOf`/`allOf` emits an `EMPTY_OBJECT_SCHEMA` `ParseWarning` —
under Fastify (fast-json-stringify) such a field serializes to `{}` at runtime,
stripping every key. `parse()` now logs collected warnings via `console.warn`
so CLI/vite-plugin users see them without switching to `parseWithWarnings()`;
the structured API is unchanged. Generated output is untouched (object fields
already emit `Record<string, unknown>`).
