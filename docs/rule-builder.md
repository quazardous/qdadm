# Rule builder

A list of rules in a YAML file (routing, alerting, filtering), built by
clicking: `QdRuleBuilder`, from `@quazardous/qdadm/editors/yaml`. Every click
is a patch of the text, so the file stays as written: comments, key order,
flow maps and quoting are kept, and one changed threshold is a one-line diff.

Most apps get it through [`YamlConfigEditor`](forms.md#yamlconfigeditor), which
adds a « Rules » view beside its editor and keeps the load, check, diff, reason
and save gesture:

```vue
<YamlConfigEditor :adapter="adapter" :rules="{ vocabulary }" @update:text="trial" />
```

A working page: the demo's « Routing rules » (`packages/demo/src/modules/ops`).

## The shape of a rule

```yaml
# Routing rules: the first rule that matches routes the event.

# les achats B2B : le prix fournisseur, pas l'IT
- name: prix d'achat invalide
  enabled: false                 # optional, true when absent
  when:
    all:                         # or any
      - channel: supplier.price  # a condition: one key, its type
      - any:                     # a nested group
          - measure: { refused: ">= 1000" }
          - measure: { refused_ratio: ">= 20%" } # the share refused
  then:
    route: purchases.b2b         # an action: a key, its value
```

The rules are a list, at the document's root or at `path` (`rules: { path: ['routing', 'rules'] }`).
A rule card gives its name, its switch (`enabled: false` is written only when
it is turned off, or when the key is already there), its conditions, its
actions, and duplicate / remove. A handle reorders the rules, by the mouse or
by the keyboard (arrows, Home, End). A moved rule takes its comment with it.
The comment above the first rule is the file's head, up to its last blank line:
it stays at the top. Leave a blank line between the head and the first rule's
own comment.

A group is `all` or `any`, and its rows are conditions or nested groups, down
to `maxDepth` (3). A row the builder cannot draw (deeper than `maxDepth`, a type
outside the vocabulary, a value that does not fit its type) shows as YAML,
read-only, with « Edit in the text », which opens the text view at that line.

## The vocabulary

The condition types and the actions, each with a label and its parameter:

```js
const vocabulary = {
  conditions: {
    channel: { label: 'Channel', param: { type: 'enum', options: [{ value: 'supplier.price', label: 'Supplier price' }] } },
    measure: { label: 'Measure', param: { type: 'keyedThreshold', keys: [{ value: 'refused' }, { value: 'refused_ratio', label: 'Refused (%)', unit: '%' }] } },
    level: { label: 'Level at least', param: { type: 'threshold' } },
  },
  actions: {
    route: { label: 'Route', param: { type: 'text', placeholder: 'team.queue', suggestions: ['it', 'purchases.b2b'] } },
    notify: { label: 'Notify', param: { type: 'boolean' } },
  },
  template: { name: 'New rule', when: { all: [] }, then: { route: '' } }, // « Add a rule »
}
```

| `param.type` | In the YAML | Edited with |
|---|---|---|
| `text` | `route: it` | an input (`placeholder`); `suggestions: ['it', { value, label }]` are offered while typing (a native datalist), the text staying free |
| `number` | `retries: 3` | a number input |
| `boolean` | `notify: true` | a checkbox |
| `enum` | `severity: critical` | a select (`options: [{ value, label? }]`) |
| `threshold` | `level: ">= 2"`, `"< 20%"` | an operator (`>=`, `>`, `<=`, `<`, `=`) and a number; `unit: '%'` |
| `keyedThreshold` | `measure: { refused_ratio: ">= 20%" }` | the key, from `keys: [{ value, label?, unit? }]`, then its threshold |

Labels go through the catalogue, so they can be i18n keys. The builder's own
texts are `core.ruleBuilder.*`.

### From a JSON Schema

`vocabularyFromSchema(schema)` reads the vocabulary from the rules' schema,
the one `YamlConfigEditor` already loads:

- the conditions are the `oneOf` of `$defs.condition` (or of the items of
  `when.all`): each an object with one required property, its key, whose
  schema is the parameter; its `title` is the label;
- the actions are the `properties` of the rules' `then`.

A parameter is an `enum` (labels in `x-enumLabels`), a number, a boolean, a
string with `x-qd-param: threshold` (`x-unit: '%'`), a string with `examples`
(its suggestions, labelled by `x-enumLabels`), an object with one property
drawn from `propertyNames.enum` and `maxProperties: 1` (a keyed threshold, its
units in `x-units`), else a text.

```json
{
  "type": "array",
  "items": {
    "properties": {
      "name": { "type": "string" },
      "when": { "$ref": "#/$defs/group" },
      "then": { "properties": { "route": { "type": "string", "title": "Route" } } }
    }
  },
  "$defs": {
    "condition": {
      "oneOf": [
        { "title": "Channel", "required": ["channel"], "properties": { "channel": { "enum": ["supplier.price", "app.warning"] } } },
        { "title": "Measure", "required": ["measure"], "properties": { "measure": {
          "type": "object", "maxProperties": 1,
          "propertyNames": { "enum": ["refused", "refused_ratio"] },
          "x-units": { "refused_ratio": "%" }
        } } }
      ]
    }
  }
}
```

## On its own

Without `YamlConfigEditor`, `QdRuleBuilder` edits a text by `v-model`, or a
vanilla-yamleditor document by `document` (its undo history then covers the
builder's edits):

```vue
<QdRuleBuilder v-model="yaml" :vocabulary="vocabulary" :max-depth="2" @reveal="showInText" />
```

| Prop | Purpose |
|---|---|
| `modelValue` / `document` | The YAML text, or a vanilla-yamleditor `YamlDocument` |
| `path` | Where the rule list is (default the root) |
| `vocabulary` | The condition types and actions |
| `maxDepth` | Group nesting drawn (default 3); deeper shows as YAML |
| `readOnly` | |

The edits it makes are exported, each a function of the text, for an app's
own gestures: `moveItem`, `duplicateItem`, `addItemAt`, `addRule`, `removeAt`,
`setAt`, `addKeyAt`, `renameKeyAt`, `setEnabled`.
