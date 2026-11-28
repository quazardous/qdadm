---
"@quazardous/qdadm": minor
---

feat(editors): a schema builder, QdSchemaBuilder and `YamlConfigEditor`'s `builder` prop with its « Builder » view: a YAML document built by clicking, its structure read from its JSON Schema, with no business key in qdadm. Each root list of objects is a section and each item a card (`x-title`, `x-enabled`), with add, duplicate, drag or keyboard reorder and remove. Fields are drawn by their schema: text with `examples` as suggestions, enum, number, boolean, threshold, lists, nested objects, key tables (`propertyNames.enum`) and an all / any tree (`x-widget: conditions`, which takes a bare condition). The app's handlers draw `x-widget: <name>`. Every click is a patch, so comments stay. The rule builder's tree accepts a bare condition (`bare`), and `duplicateItem` takes the title key (#5587).
