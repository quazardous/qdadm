<script setup>
/**
 * GenreForm - Edit genre page with PageNav for child navigation
 */

import { useRoute } from 'vue-router'
import { useForm, PageLayout, FormField, FormActions, PageNav } from 'qdadm'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

const route = useRoute()

// ============ FORM SETUP ============
const {
  manager,
  form,
  loading,
  saving,
  dirty,
  isEdit,
  submit,
  cancel
} = useForm({
  entity: 'genres',
  getId: () => route.params.id
})
</script>

<template>
  <PageLayout
    :title="isEdit ? `Edit ${manager.label}: ${form.name}` : `Add ${manager.label}`"
    :entity="form"
    :manager="manager"
  >
    <template #nav>
      <PageNav :entity="form" />
    </template>

    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
    </div>

    <Card v-else>
      <template #content>
        <div class="form-grid">
          <FormField name="name" label="Name *">
            <InputText v-model="form.name" id="name" class="w-full" />
          </FormField>

          <FormField name="description" label="Description">
            <Textarea v-model="form.description" id="description" class="w-full" rows="3" />
          </FormField>
        </div>

        <FormActions
          :isEdit="isEdit"
          :saving="saving"
          :dirty="dirty"
          @save="submit(false)"
          @saveAndClose="submit(true)"
          @cancel="cancel"
        />
      </template>
    </Card>
  </PageLayout>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}
</style>
