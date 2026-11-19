<script setup>
/**
 * ApiKeyForm - a key: its value shown once at creation (#5319), its scopes
 * as chips or YAML (#5333), and Revoke instead of Delete
 *
 * Nothing here about the value: the entity's `revealOnce` says the create
 * answer carries it, and FormPage shows it in QdRevealOnce before going on.
 */
import { useEntityItemFormPage, FormPage, FormField, PermissionEditor, StructuredField, useI18n } from '@quazardous/qdadm'
// Registers the YAML face of StructuredField
import '@quazardous/qdadm/editors/yaml'
import InputText from 'primevue/inputtext'
import { KEY_SCOPES } from '../scopes'

const { t } = useI18n()
const form = useEntityItemFormPage({ entity: 'apikeys' })
form.generateFields()
form.excludeField('prefix')
form.excludeField('state')
form.excludeField('created_at')
form.addSaveAction({ andClose: true })
form.addDeleteAction({
  label: t('entities.apikeys.revoke.action'),
  icon: 'pi pi-ban',
  confirmHeader: t('entities.apikeys.revoke.header'),
  confirmMessage: (item, label) => t('entities.apikeys.revoke.message', { label }),
})
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label" :full-width="f.name === 'scopes'">
          <StructuredField v-if="f.name === 'scopes'" v-model="form.data.value.scopes" format="yaml" raw-height="220px">
            <PermissionEditor v-model="form.data.value.scopes" :permissions="KEY_SCOPES" />
          </StructuredField>
          <InputText v-else v-model="form.data.value[f.name]" class="w-full" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
