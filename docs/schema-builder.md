# Schema builder

A YAML document built by clicking, its structure read from its JSON Schema:
`QdSchemaBuilder`, from `@quazardous/qdadm/editors/yaml`. qdadm knows no
business key. The schema says what the document holds, a few generic `x-…`
annotations say how to draw it, and the app brings widgets of its own for the
rest. Every click is a patch of the text, so comments, key order and layout
stay as written.

Most apps get it through [`YamlConfigEditor`](forms.md#yamlconfigeditor). Its
`builder` prop adds a « Builder » view, which uses the schema the adapter loads:

```vue
<YamlConfigEditor :adapter="adapter" :builder="{ handlers: { regex: RegexField } }" />
```

A working page: the demo's « Log rules » (`packages/demo/src/modules/ops`).

## What the schema draws

- **Sections.** Each root property that is an array of objects is a section,
  labelled by its `title`, with its item count. A root that is itself an array
  is a single section. `x-section: false` leaves a property out.
- **Items.** An item is a card: add, duplicate, reorder (drag, or the keyboard:
  arrows, Home, End), remove. A moved item keeps its comment.
  - `x-title: <key>` names the item's title key, edited in the card's head.
  - `x-enabled: <key>` names the key behind its switch: `false` is written when
    it is turned off, and the key is left out while the item is on.
- **Fields.** The item's properties, in the schema's order. An optional
  property that is absent is offered by « Add a field »; one present can be
  removed unless it is `required`. Keys the schema does not list show as YAML.

| Schema | Drawn as |
|---|---|
| `string` | a text input; `examples` are offered while typing, the text staying free |
| `enum` | a select, labelled by `x-enumLabels` |
| `number`, `integer`, `boolean` | a number input, a checkbox |
| `string` with `x-qd-param: threshold` (or `x-widget: threshold`) | an operator and a number: `>= 20%` (`x-unit: '%'`) |
| `array` of strings or numbers | a list: add, remove |
| `object` with `properties` | its fields, nested |
| `object` with `propertyNames.enum` (or `additionalProperties` of a scalar type) | a **key table**: keys from the list (labelled by `x-enumLabels`), or free keys; each with a text, its suggestions from `additionalProperties.examples` |
| `object` with `propertyNames.enum` and `maxProperties: 1` | a keyed threshold: `{ refused_ratio: ">= 20%" }` |
| `x-widget: conditions` | an `all` / `any` tree (the [rule builder](rule-builder.md)'s), its condition types read from the node's `oneOf` |
| `x-widget: <name>` | the app's handler of that name |
| anything else | the YAML, read-only, with « Edit in the text » |

A value that does not fit its schema also shows as YAML, so the builder never
rewrites what it cannot draw.

### An all / any tree

The condition types are found by walking the node's `oneOf` / `anyOf`, its
refs and its groups' items: each object variant with one required key (not
`all` / `any`) is a type, labelled by its `title`, its value drawn by its
schema. The tree takes a bare condition as well (`when: { channel: x }`): it
is wrapped in `all` when a second condition is added, or in the group chosen.

```json
{
  "$defs": {
    "when": { "x-widget": "conditions", "oneOf": [{ "$ref": "#/$defs/condition" }, { "$ref": "#/$defs/group" }] },
    "group": { "oneOf": [
      { "required": ["all"], "properties": { "all": { "type": "array", "items": { "$ref": "#/$defs/when" } } } },
      { "required": ["any"], "properties": { "any": { "type": "array", "items": { "$ref": "#/$defs/when" } } } }
    ] },
    "condition": { "oneOf": [
      { "title": "Channel", "required": ["channel"], "properties": { "channel": { "type": "string", "examples": ["supplier.*"] } } },
      { "title": "Kind", "required": ["kind"], "properties": { "kind": { "enum": ["warning", "error"] } } }
    ] }
  }
}
```

## Handlers

A property with `x-widget: <name>` is drawn by the app's handler of that name,
when there is one. An app handler takes precedence over a built-in widget of
the same name. A handler is a component:

| Prop | |
|---|---|
| `value` | The property's value in the YAML |
| `path` | Where it is in the document |
| `schema` | Its schema, refs resolved: its `title`, its own annotations |
| `readOnly` | |

It emits `update(value)` to set the value in place (its line, its comment
kept), or `apply(patch)`, a function of the text, for anything more.

```vue
<script setup>
defineProps({ value: null, path: Array, schema: Object, readOnly: Boolean })
const emit = defineEmits(['update'])
</script>
<template>
  <input :value="value" :disabled="readOnly" @change="emit('update', $event.target.value)" />
</template>
```

## On its own

```vue
<QdSchemaBuilder v-model="yaml" :schema="schema" :handlers="handlers" @reveal="showInText" />
```

| Prop | Purpose |
|---|---|
| `modelValue` / `document` | The YAML text, or a vanilla-yamleditor `YamlDocument` (its undo history then covers the builder's edits) |
| `schema` | The document's JSON Schema |
| `handlers` | `{ name: Component }`, for `x-widget` |
| `readOnly` | |

`sectionsOf(schema)`, `fieldKind(schema, root, handlerNames)` and
`conditionTypes` expose the reading of the schema; `addListItem` and the
[rule builder](rule-builder.md)'s edits make the patches.
