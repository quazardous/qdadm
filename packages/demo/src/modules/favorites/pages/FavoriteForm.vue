<script setup>
/**
 * FavoriteForm - Create/Edit form for favorites
 *
 * DEMO: LookupField with two picker modes
 * ==========================================
 * The entityId field uses LookupField to select a book.
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

const form = useEntityItemFormPage({ entity: 'favorites' })

form.generateFields()
form.addSaveAction({ andClose: true })

if (form.isEdit.value) {
  form.addDeleteAction()
}

// Show book lookup only when entityType is 'book'
const showBookLookup = computed(() => form.data.value.entityType === 'book')
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <!-- entityId when type=book: LookupField with mode toggle -->
          <template v-if="f.name === 'entityId' && showBookLookup">
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
