<script setup>
/**
 * {{EntityName}}Form - Unified Create/Edit form template
 *
 * Single Form Pattern: handles both create and edit modes.
 * Mode detection is automatic via useEntityItemFormPage.
 *
 * Replace {{EntityName}} and {{entity_name}} with your entity names.
 */
import { useEntityItemFormPage, FormPage, FormField } from 'qdadm'
import InputText from 'primevue/inputtext'

const form = useEntityItemFormPage({ entity: '{{entity_name}}' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()  // Only shown in edit mode
</script>
<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <InputText v-if="f.type === 'text'" v-model="form.data.value[f.name]" class="w-full" />
          <!-- Add more field types as needed:
          <InputNumber v-else-if="f.type === 'number'" v-model="form.data.value[f.name]" class="w-full" />
          <Select v-else-if="f.type === 'select'" v-model="form.data.value[f.name]" :options="f.options" optionLabel="label" optionValue="value" class="w-full" />
          <Textarea v-else-if="f.type === 'textarea'" v-model="form.data.value[f.name]" class="w-full" rows="5" />
          -->
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
