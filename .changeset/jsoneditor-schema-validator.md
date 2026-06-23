---
"@quazardous/qdadm": minor
---

`VanillaJsonEditor` now supports inline JSON Schema validation (qdadm #1050).

New optional props forward vanilla-jsoneditor's native `validator`:

- `:schema="<JSON Schema>"` — compiled with `createAjvValidator` (Ajv is bundled in vanilla-jsoneditor, no new dependency), errors are highlighted live in the editor tree/text;
- `:validator="<fn>"` — a raw validator for advanced cases, takes precedence over `schema`;
- `:schema-definitions` / `:ajv-options` — passthrough to the Ajv validator.

With none set, behavior is unchanged (no validation). Schema/validator changes are reactive (`editor.updateProps`). Validation errors already surface through the existing `error` event and the editor's status bar.
