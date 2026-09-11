---
"@quazardous/qdadm": patch
---

A native checkbox, radio, range or colour input inside a `FormField` keeps its own size (#2319). qdadm's form styles forced every `input` in a `.form-field` to `width: 100% !important`, so a native checkbox was stretched across the whole row. A checkbox or radio placed directly in the field is no longer stretched by its flex column either. Text-like inputs and PrimeVue's own controls still take the full width; PrimeVue's Checkbox, RadioButton and ToggleSwitch look as before.
