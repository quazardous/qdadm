<script setup>
/**
 * {{EntityName}}Form - Unified Create/Edit form template
 *
 * One component for both modes, detected from the route. FormInput renders
 * each field by its type.
 */
import { useEntityItemFormPage, FormPage, FormField, FormInput } from '@quazardous/qdadm'

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
          <FormInput :field="f" v-model="form.data.value[f.name]" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
