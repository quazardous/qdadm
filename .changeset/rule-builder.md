---
"@quazardous/qdadm": minor
---

feat(editors): a rule builder for rules kept in YAML (QdRuleBuilder, `YamlConfigEditor`'s `rules` prop and its « Rules » view): rules, all / any groups nested up to `maxDepth`, conditions and actions from a vocabulary (text, number, boolean, enum, threshold, keyed threshold) or from the rules' JSON Schema (`vocabularyFromSchema`); every click is a patch of the text, so comments and layout stay; rules reordered by drag or keyboard, their comments moving with them; `update:text` (debounced by `textDelay`) and the exposed `text` / `document`, for a live trial (#5581)
