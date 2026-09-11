---
"@quazardous/qdadm": minor
---

Form labels name their field (#2268).

- **`FormField`'s label now points at the control inside it.** Clicking the label focuses the field, and screen readers and agents read the field by its label (`textbox "Title"`, `combobox "Genre"`).
- **The ids are unique per field instance,** so two forms on one page do not collide.
- **`FormInput` binds the id with each PrimeVue control's own prop.** A widget put directly in the slot takes it after render, or keeps its own id and the label follows. The slot also receives `inputId` and `labelId`.
