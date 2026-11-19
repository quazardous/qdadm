<script setup>
/**
 * FavoriteForm - Create/Edit form for favorites
 *
 * DEMO: LookupField with two picker modes
 * ==========================================
 * The itemId field uses LookupField to select a book (kind "Record", entity "books"); the
 * picked book becomes the favourite's page on save.
 * Two modes are demonstrated via a toggle:
 * - **inline**: AutoComplete with dropdown — type to filter, user sees title only (hidden display).
 * - **picker**: Readonly input + search button — opens a modal DataTable for rich search.
 *
 * LookupField handles encode/decode/resolve internally via the useOptionsLookup return.
 * The form just v-models the raw value (bookId) — no manual transformLoad/transformSave needed.
 */

import { computed, ref } from 'vue'
import { useEntityItemFormPage, FormPage, FormField, LookupField, useOptionsLookup } from '@quazardous/qdadm'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'

// Mapped mode: books with hidden ID (user sees title only)
const bookLookup = useOptionsLookup({
  entity: 'books',
  label: 'title',
  value: 'bookId',
  displayMode: 'hidden',
})

// Toggle between inline and picker mode (demo purposes)
const pickerMode = ref('inline')
const pickerModeOptions = [
  { label: 'Inline', value: 'inline' },
  { label: 'Picker', value: 'picker' },
]

// A book picked here becomes the favourite's page (#5349: qdadm reads `to`)
const form = useEntityItemFormPage({
  entity: 'favorites',
  transformSave: (data) => ({
    ...data,
    ...(data.kind === 'item' && data.entity === 'books' && data.itemId && !data.to ? { to: `/books/${data.itemId}` } : {}),
    at: data.at || new Date().toISOString(),
  }),
})

form.generateFields()
form.addSaveAction({ andClose: true })

if (form.isEdit.value) {
  form.addDeleteAction()
}

// Show the book lookup for a record of the books
const showBookLookup = computed(() => form.data.value.kind === 'item' && form.data.value.entity === 'books')
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <!-- itemId for a record of the books: LookupField with mode toggle -->
          <template v-if="f.name === 'itemId' && showBookLookup">
            <div class="flex flex-column gap-2">
              <SelectButton
                v-model="pickerMode"
                :options="pickerModeOptions"
                optionLabel="label"
                optionValue="value"
                :allowEmpty="false"
                size="small"
              />
              <LookupField
                v-model="form.data.value[f.name]"
                :lookup="bookLookup"
                :pickerMode="pickerMode"
                :pickerColumns="['title', 'author', 'year', 'genre']"
                pickerTitle="Select a Book"
                placeholder="Search books by title..."
              />
            </div>
          </template>

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
