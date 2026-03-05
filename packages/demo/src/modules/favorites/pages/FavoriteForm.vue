<script setup>
/**
 * FavoriteForm - Create/Edit form for favorites
 *
 * DEMO: useOptionsLookup (Mapped Mode with encode/decode)
 * ========================================================
 * The entityId field uses useOptionsLookup in mapped mode: source items are
 * book objects with label (title) ≠ value (bookId). Suggestions are encoded
 * as "Title [bookId]" strings. On save, decode() extracts the raw ID.
 * On load, resolve() converts the stored ID back to the display string.
 *
 * If the user types a custom value without selecting from the list,
 * decode() returns it as-is (no brackets → whole string is the value).
 */

import { computed, ref, watch } from 'vue'
import { useEntityItemFormPage, FormPage, FormField, useOptionsLookup } from 'qdadm'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'

// Mapped mode autocomplete: books with "Title [bookId]"
const bookLookup = useOptionsLookup({
  entity: 'books',
  label: 'title',
  value: 'bookId',
})

// Display value for the AutoComplete (encoded string, not the raw ID)
const entityIdDisplay = ref('')

const form = useEntityItemFormPage({
  entity: 'favorites',
  // On load: convert raw entityId to encoded display string
  transformLoad: (data) => {
    if (data.entityType === 'book' && data.entityId) {
      entityIdDisplay.value = bookLookup.resolve(data.entityId)
    } else {
      entityIdDisplay.value = data.entityId ?? ''
    }
    return data
  },
  // On save: decode display string back to raw ID
  transformSave: (data) => {
    if (data.entityType === 'book' && entityIdDisplay.value) {
      data.entityId = bookLookup.decode(entityIdDisplay.value)
    }
    return data
  },
})

form.generateFields()
form.addSaveAction({ andClose: true })

if (form.isEdit.value) {
  form.addDeleteAction()
}

// Show autocomplete only when entityType is 'book'
const showBookAutocomplete = computed(() => form.data.value.entityType === 'book')

// When options load after initial render, resolve display for edit mode
watch(() => bookLookup.options.value.length, () => {
  if (form.isEdit.value && form.data.value.entityId && !entityIdDisplay.value) {
    entityIdDisplay.value = bookLookup.resolve(form.data.value.entityId)
  }
})

// Sync display changes back to form data (for dirty detection)
watch(entityIdDisplay, (val) => {
  if (showBookAutocomplete.value) {
    form.data.value.entityId = val
  }
})
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <!-- entityId when type=book: mapped autocomplete "Title [bookId]" -->
          <AutoComplete
            v-if="f.name === 'entityId' && showBookAutocomplete"
            v-model="entityIdDisplay"
            :suggestions="bookLookup.suggestions.value"
            @complete="bookLookup.search($event.query)"
            :loading="bookLookup.loading.value"
            placeholder="Search books by title..."
            class="w-full"
          />

          <!-- Default text input -->
          <InputText
            v-else-if="f.type === 'text'"
            v-model="form.data.value[f.name]"
            class="w-full"
            :disabled="f.readOnly"
          />

          <Select
            v-else-if="f.type === 'select'"
            v-model="form.data.value[f.name]"
            :options="f.options"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
