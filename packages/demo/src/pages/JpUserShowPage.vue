<script setup>
/**
 * JpUserShowPage - JSONPlaceholder User detail page using ShowPage builder
 *
 * Demonstrates mixing auto-generated fields with custom sections for nested data.
 */
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from 'qdadm'
import { useRouter, useRoute } from 'vue-router'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()

const show = useEntityItemShowPage({ entity: 'jp_users' })

// Generate fields from schema
show.generateFields()

// Customize email as mailto link
show.updateField('email', { type: 'email' })

// Customize website as URL
show.updateField('website', { type: 'url' })

// Add actions
show.addBackAction({ route: 'jp_user' })
show.addAction({
  name: 'viewPosts',
  label: 'View Posts',
  icon: 'pi pi-file-edit',
  severity: 'info',
  onClick: () => router.push({ name: 'post', query: { userId: route.params.id } })
})
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <!-- Auto-generated fields -->
      <ShowField
        v-for="f in show.fields.value"
        :key="f.name"
        :field="f"
        :value="show.data.value?.[f.name]"
        horizontal
        label-width="120px"
      />

      <!-- Custom section: Address -->
      <div v-if="show.data.value?.address" class="detail-section">
        <h3 class="section-title">Address</h3>
        <ShowField label="Street" horizontal label-width="120px">
          {{ show.data.value.address.street }}, {{ show.data.value.address.suite }}
        </ShowField>
        <ShowField label="City" horizontal label-width="120px">
          {{ show.data.value.address.city }} {{ show.data.value.address.zipcode }}
        </ShowField>
      </div>

      <!-- Custom section: Company -->
      <div v-if="show.data.value?.company" class="detail-section">
        <h3 class="section-title">Company</h3>
        <ShowField label="Name" horizontal label-width="120px">
          {{ show.data.value.company.name }}
        </ShowField>
        <ShowField label="Catchphrase" horizontal label-width="120px">
          {{ show.data.value.company.catchPhrase }}
        </ShowField>
      </div>
    </template>
  </ShowPage>
</template>

<style scoped>
.detail-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin: 0 0 1rem 0;
}
</style>
