# Forms & Field Widgets — the full editing surface

> **Where to start for forms.** This guide covers *how fields are rendered and
> edited*. For the **form page lifecycle** (builder, save/delete actions, mode
> detection, groups) see [crud.md#form-page](./crud.md#form-page). For *which
> page composition to reach for* see [page-compositions.md](./page-compositions.md).

qdadm forms are a small **façade stack**: you describe fields once on the
`EntityManager`, and the form layer renders the right input for each one. When
the built-in inputs aren't enough, you drop a **rich widget** into the same slot
— it keeps the form's dirty-tracking and validation for free.

```
EntityManager.fields ──> useEntityItemFormPage (builder) ──> FormPage
                                                               └─ #fields slot
                                                                   └─ FormField (label + error + dirty)
                                                                       └─ FormInput      ← façade: type → PrimeVue input
                                                                          or a widget    ← LookupField / KeyValueEditor / Json* …
```

---

## 1. The form façade — `FormInput`

`FormInput` is the **per-field façade**: hand it a resolved field config and it
renders the matching PrimeVue input from `field.type`. This is what makes a basic
form a one-liner — you never pick the input component by hand.

```vue
<template #fields>
  <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
    <FormInput :field="f" v-model="form.data.value[f.name]" />
  </FormField>
</template>
```

### Built-in type → input mapping

| `field.type` | Rendered input |
|---|---|
| `text` / `email` | `InputText` |
| `password` | `Password` (toggle mask) |
| `number` | `InputNumber` |
| `textarea` | `Textarea` |
| `select` | `Select` (options / `optionLabel` / `optionValue`) |
| `boolean` | `Checkbox` (binary) |
| `date` / `datetime` | `DatePicker` (ISO-string ↔ `Date` conversion) |
| *(anything else)* | falls back to `InputText` |

`FormInput` reads `placeholder`, `disabled`, `readonly`, and the select option
keys straight off the field config. Set them in the `EntityManager` field
definition (see [crud.md#field-definition](./crud.md#field-definition)) and they
flow through automatically.

---

## 2. `FormField` — label, error, dirty (works with **any** input)

`FormField` is the wrapper that gives a row its label, validation error, and
dirty marker. It does **not** care what's inside — `FormInput`, a raw PrimeVue
component, or a rich widget all behave the same. It pulls `isFieldDirty`,
`getFieldError`, `handleFieldBlur`, and `formSubmitted` from the form via
`inject`, so a hand-placed widget still participates in validation and the
unsaved-changes guard.

| Prop | Purpose |
|---|---|
| `name` | **Required.** Field key (drives dirty + error lookup) |
| `label` | Row label |
| `hint` | Helper text under the input |
| `error` | Override error message (custom validation) |
| `showErrorOnSubmit` | Only show the error after submit |
| `fullWidth` | Stretch the field row |

### Nested values (path-addressable dirty)

`name` accepts dot paths: a `FormField` bound to a sub-field of a JSON
object tracks dirty like any root field —

```vue
<FormField name="config.login" label="Login">
  <InputText v-model="form.data.value.config.login" />
</FormField>
```

`isFieldDirty('config.login')` compares that exact path between the current
form and the snapshot. No flattening via `transformLoad`/`transformSave`
needed. Dot-free names behave exactly as before. (Repeatable rows —
`items.0.foo` with add/remove shifting indices — are not index-stable;
prefer keys that don't move.)

---

## 3. Dropping a custom widget into a form

When a field needs more than a plain input — an entity picker, a key/value map,
a JSON blob — **skip `FormInput` and put the widget directly inside `FormField`**.
Everything else (dirty state, error display, the guard) keeps working because it
lives on `FormField`, not on `FormInput`.

```vue
<template #fields>
  <div class="form-grid">
    <!-- ordinary fields via the façade -->
    <FormField v-for="f in simpleFields" :key="f.name" :name="f.name" :label="f.label">
      <FormInput :field="f" v-model="form.data.value[f.name]" />
    </FormField>

    <!-- a rich widget in the same grid -->
    <FormField name="quotas" label="Quotas">
      <KeyValueEditor v-model="form.data.value.quotas" valueType="number" :min="0" :max="100" />
    </FormField>

    <FormField name="bookId" label="Book">
      <LookupField v-model="form.data.value.bookId" :lookup="bookLookup" />
    </FormField>
  </div>
</template>
```

That's the whole integration story — there is **no widget registry**; widgets
are plain components you render where you want them.

---

## 4. Widget catalog

These ship with qdadm and are the "rich" side of the form surface. Most are in
the main bundle; the `vanilla-jsoneditor`-backed ones live in the
`@quazardous/qdadm/editors` subpath (so the heavy dep stays opt-in).

### Entity picker — `LookupField` (+ `LookupPickerDialog`)

The go-to input for a **reference to another entity**, backed by
`useOptionsLookup`. Two UI modes, single or multiple selection.

```vue
<!-- inline autocomplete (default) -->
<LookupField v-model="form.data.value.bookId" :lookup="bookLookup" />

<!-- modal picker for large datasets -->
<LookupField v-model="bookId" :lookup="bookLookup" pickerMode="picker"
  :pickerColumns="['title', 'author']" pickerTitle="Select a Book" />

<!-- multi-select (chips inline, checkboxes in picker) -->
<LookupField v-model="conditions.tags" :lookup="tagLookup" multiple />
```

| Mode | UI |
|---|---|
| `inline` (default) | `AutoComplete` with dropdown button |
| `picker` | readonly input + search button → modal `DataTable` (`LookupPickerDialog`) |

### Key/value & domain editors (main bundle)

| Widget | Edits | Notable props |
|---|---|---|
| `KeyValueEditor` | array of `{key, value}` | `valueType` (`number`\|`text`), `min`/`max`/`step`, `keySuggestions`, `showSign`, `colorize` |
| `LanguageEditor` | array of `{code, fluency, primary}` | `label`, `help` |
| `ScopeEditor` | array of `resource:action` scope strings | `scopeEndpoint`, `scopePrefix`, `defaultResources`, `defaultActions` |
| `PermissionEditor` | a `namespace:action` permission string | segment-aware autocomplete (type `au` → `auth:` → actions) |

### JSON family

| Widget | Subpath | Use |
|---|---|---|
| `JsonViewer` | main | Read-only formatted JSON with syntax highlighting |
| `JsonEditorFoldable` | main | JSON editor with collapsible top-level sections (`:defaultExpanded`) |
| `VanillaJsonEditor` | `/editors` | Full tree/text/table editor (`vanilla-jsoneditor`), **inline JSON-Schema validation** via `:schema` |
| `JsonStructuredField` | `/editors` | **Structured ↔ raw JSON dual** — a slot for your structured editor, a toggle to the raw editor |

```js
// the two vanilla-jsoneditor-backed widgets are opt-in:
import { VanillaJsonEditor, JsonStructuredField } from '@quazardous/qdadm/editors'
```

#### Inline schema validation — `VanillaJsonEditor`

Pass a JSON Schema and errors are highlighted live in the editor (Ajv is bundled
in `vanilla-jsoneditor`, no extra dep). A raw `:validator` takes precedence for
advanced cases.

```vue
<VanillaJsonEditor v-model="rules" :schema="rulesSchema" />
<VanillaJsonEditor v-model="rules" :validator="myValidator" />
```

#### The structured/raw dual — `JsonStructuredField`

This is the "edit it as a form **or** as raw JSON" pattern: the default slot is
your structured editor, and a `SelectButton` toggles to an embedded
`VanillaJsonEditor` for the raw view. Switching back from invalid JSON is guarded
by default.

```vue
<JsonStructuredField v-model="myData">
  <MyStructuredEditor v-model="myData" />   <!-- structured view -->
</JsonStructuredField>                       <!-- raw view auto-provided -->
```

| Prop | Purpose |
|---|---|
| `modelValue` | The JSON object (raw view falls back to this if `jsonValue` absent) |
| `jsonValue` / `@update:jsonValue` | Separate binding when the raw shape differs from the structured one |
| `mode` / `v-model:mode` | Controlled view mode (`structured` \| `json`) |
| `defaultMode` | Initial view (default `structured`) |
| `jsonMode` | Underlying editor mode (default `text`) |
| `guardInvalidJson` | Block leaving the raw view while JSON is invalid (default `true`) |

#### Most common structured face — `LookupField multiple` over a catalog

In practice the structured slot is rarely a bespoke editor — it's usually a
**"pick + add from a catalog of allowed values"**, i.e. `LookupField multiple`
fed by [`useOptionsLookup`](#useoptionslookup--options-for-lookupfield). This is
the idiomatic way to edit a `string[]` whitelist as either a form **or** raw
JSON. Both faces bind the **same** `v-model` (the `string[]`); an empty list is a
meaningful value. Wrapping it in `FormField` keeps dirty-tracking and validation.

```vue
<script setup>
import { useOptionsLookup } from '@quazardous/qdadm'
import { LookupField } from '@quazardous/qdadm/components'
import { JsonStructuredField } from '@quazardous/qdadm/editors'

// entity-backed: goes through the registered EntityManager/storage,
// so base URL + auth are applied for you
const taskTypeLookup = useOptionsLookup({ entity: 'taskTypes', label: 'name', value: 'id' })
</script>

<template>
  <FormField name="taskTypes" label="Task Types" full-width hint="Empty = accept all.">
    <JsonStructuredField v-model="model" json-mode="text" json-height="200px">
      <LookupField v-model="model" :lookup="taskTypeLookup" multiple placeholder="Add a value…" />
    </JsonStructuredField>
  </FormField>
</template>
```

The structured face doesn't have to be a `LookupField` — any component works in
the slot (e.g. cascading `Select`s + add-button + chips fed by a manager method,
for composite values like `module:type`). The contract is only "binds the same
`v-model`".

### `useOptionsLookup` — options for `LookupField`

`LookupField` is fed by `useOptionsLookup`, which sources its options from one of
**three** places (and optionally maps each item to `{ label, value }`):

| Source | Call | Yields |
|---|---|---|
| **Entity** | `useOptionsLookup({ entity: 'botPools', label: 'name', value: 'id' })` | Options from a registered `EntityManager` |
| **Endpoint** | `useOptionsLookup({ endpoint: '/api/task-types', label, value })` | Options fetched from an API endpoint |
| **Static** | `useOptionsLookup({ static: ['a', 'b', 'c'] })` | A fixed in-memory list |

**Endpoint routing** *(since 2.1)* — register your API client once on the kernel
and relative endpoints Just Work (base URL + auth applied):

```js
new Kernel({ apiClient: myAxios })   // the same client your ApiStorages use
```

| Endpoint shape | Routed through |
|---|---|
| `via: 'entityName'` set | That entity's `storage.request()` (explicit, multi-API apps) |
| Relative (`/api/…`) | The kernel `apiClient` → base URL + auth, zero per-call wiring |
| Absolute (`https://…`) | Raw `fetch` + optional `headers` — the escape hatch for third-party APIs |
| Relative, **no** `apiClient` registered | Legacy raw fetch + a console warning |

Failed lookups are always diagnosable: a non-JSON response (HTML page), 401/403,
or a parse failure logs a `console.warn` naming the endpoint and the likely
cause — an empty autocomplete is never silent.

Omit `label`/`value` for a **pure** `string[]`/`number[]` source (suggestions are
the raw values); provide them for **mapped** mode when items are objects and the
label differs from the stored value. See the composable's docstring for
`displayMode` (`bracket` vs `hidden`) and custom `encode`/`decode`.

---

## 5. Non-entity / standalone forms — `useBareForm`

Not every form maps to a CRUD entity item. `useBareForm` is the **bare form
façade**: it gives you the same plumbing `useEntityItemFormPage` builds on —
dirty tracking, the unsaved-changes guard, auto page title and breadcrumb,
`cancel()` navigation — **without** an entity item lifecycle. Use it for wizard
steps, settings panels, or any custom save flow.

```js
const { dirty, isFieldDirty, takeSnapshot, cancel, guardDialog } = useBareForm({
  getState: () => ({ form: form.value }),
  routePrefix: 'agents',     // cancel() target + derived title
  entity: 'agents',          // optional: pull label/labelField from the manager
  guard: true,               // unsaved-changes modal
  onGuardSave: () => save(),
})
```

It provides `isFieldDirty`/`dirtyFields` to child `FormField`s (same `inject`
contract as the entity form), so the widget catalog above works inside a bare
form too. Wire `guardDialog` through the shared guard store — `AppLayout`
renders the dialog automatically.

| Returns | What |
|---|---|
| `loading` / `saving` / `dirty` / `dirtyFields` | Form state |
| `isEdit` / `entityId` | Derived from the route |
| `isFieldDirty` / `takeSnapshot` / `checkDirty` / `reset` | Dirty tracking |
| `cancel` | Navigate back (to `routePrefix` or history) |
| `breadcrumb` / `pageTitleParts` | Auto metadata for `PageHeader` |
| `guardDialog` | State for the `UnsavedChangesDialog` |

---

## See also

- [crud.md#form-page](./crud.md#form-page) — form page builder, save/delete, mode detection, `FieldGroups` layouts.
- [crud.md#field-definition](./crud.md#field-definition) — declaring fields, types, validators on the `EntityManager`.
- [page-compositions.md](./page-compositions.md) — choosing the page composition (list / form / show / hybrids).
</content>
</invoke>
