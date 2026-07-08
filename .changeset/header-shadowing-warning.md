---
"@quazardous/qdadm": minor
---

Column header shadowing made loud + consistent (#1255). When an i18n key
`entities.{entity}.fields.{field}` shadows an explicit header (per-call
`column()` override or inline `addColumn` header) with a DIFFERENT value, a
one-shot dev warning announces it (deduped per entity+field; silent when the
key merely copies the header). The precedence itself is unchanged and now
documented where it lives: the catalog wins by design — an inline `header`
is the no-key fallback, not an absolute override; to pin a header, don't
create the key.

Consistency fix uncovered by the warning's tests: `addColumn` used to let
the inline header win at registration and only flip to the i18n value on the
first locale change — silently and inconsistently. The catalog now wins at
registration too.
