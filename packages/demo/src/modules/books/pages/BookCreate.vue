<script setup>
import { useFormPageBuilder, FormPage, FormField } from 'qdadm'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'

const form = useFormPageBuilder({ entity: 'books' })
form.generateFields()
form.addSaveAction({ andClose: true })
</script>
<template>
  <FormPage v-bind="form.props" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <InputText v-if="f.type === 'text'" v-model="form.data.value[f.name]" class="w-full" />
          <InputNumber v-else-if="f.type === 'number'" v-model="form.data.value[f.name]" class="w-full" :useGrouping="false" />
          <Select v-else-if="f.type === 'select'" v-model="form.data.value[f.name]" :options="f.options" optionLabel="label" optionValue="value" class="w-full" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
