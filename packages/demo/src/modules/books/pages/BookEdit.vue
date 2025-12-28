<script setup>
/**
 * BookEdit - Book edit page
 *
 * ZONE EXTENSIBILITY DEMO
 * =======================
 * This page uses the 'books-detail-content' zone which can be wrapped
 * by other modules. The Loans module wraps this zone to show loan
 * availability status around the form content.
 *
 * See: modules/loans/components/LoansZoneSetup.vue for wrap operation
 */
import { useFormPageBuilder, FormPage, FormField, Zone } from 'qdadm'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'

const form = useFormPageBuilder({ entity: 'books' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>
<template>
  <FormPage v-bind="form.props" v-on="form.events">
    <template #fields>
      <!-- Zone-based extensible content wrapper -->
      <Zone name="books-detail-content">
        <div class="form-grid">
          <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
            <InputText v-if="f.type === 'text'" v-model="form.data.value[f.name]" class="w-full" />
            <InputNumber v-else-if="f.type === 'number'" v-model="form.data.value[f.name]" class="w-full" :useGrouping="false" />
            <Select v-else-if="f.type === 'select'" v-model="form.data.value[f.name]" :options="f.options" optionLabel="label" optionValue="value" class="w-full" />
          </FormField>
        </div>
      </Zone>
    </template>
  </FormPage>
</template>
