<script setup>
/**
 * JpUserShowPage - JSONPlaceholder User detail page using ShowPage builder
 *
 * Demonstrates field groups with tabs layout, including icons and badges.
 */
import { computed, inject } from 'vue'
import { useEntityItemShowPage, ShowPage, ShowField, FieldGroups, PageNav } from '@quazardous/qdadm'
import { useRouter, useRoute } from 'vue-router'
import Button from 'primevue/button'
import { JP_USER_PHONE_KEY } from '../modules/jsonplaceholder/JsonPlaceholderModule'

const router = useRouter()
const route = useRoute()

const show = useEntityItemShowPage({ entity: 'jp_users' })

// Demo (#2677, #2685): what a live backend would send when this user changes
// elsewhere. The badge flashes and the page reloads. The entity decides whether
// that is worth a notification entry: an unchanged record adds none, a new phone
// number adds one, linked back here.
const signals = inject('qdadmSignals', null)
function simulateRemoteChange() {
  signals?.emit('entity:data-invalidate', { entity: 'jp_users', id: route.params.id, action: 'updated', source: 'remote' })
}
function simulatePhoneChange() {
  const phone = `+33 1 ${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/(..)(?=.)/g, '$1 ')}`
  try { sessionStorage.setItem(JP_USER_PHONE_KEY + route.params.id, phone) } catch { /* storage blocked */ }
  simulateRemoteChange()
}

// Generate fields from schema and organize into groups
show.generateFields({ exclude: ['address', 'company'] })

// Customize field types
show.updateField('email', { type: 'email' })
show.updateField('website', { type: 'url' })

// Define groups with icons and organize fields
show.group('info', ['id', 'name', 'username'], {
  label: 'Identity',
  icon: 'user',
})
show.group('contact', ['email', 'phone', 'website'], {
  label: 'Contact',
  icon: 'envelope',
  badge: '3',
  badgeSeverity: 'info',
})

// Add virtual fields for nested address data
show.addField('address.street', { label: 'Street', type: 'text' })
show.addField('address.suite', { label: 'Suite', type: 'text' })
show.addField('address.city', { label: 'City', type: 'text' })
show.addField('address.zipcode', { label: 'Zipcode', type: 'text' })
show.group('address', ['address.street', 'address.suite', 'address.city', 'address.zipcode'], {
  label: 'Address',
  icon: 'map-marker',
})

// Add virtual fields for nested company data
show.addField('company.name', { label: 'Company Name', type: 'text' })
show.addField('company.catchPhrase', { label: 'Catchphrase', type: 'text' })
show.addField('company.bs', { label: 'Business', type: 'text' })
show.group('company', ['company.name', 'company.catchPhrase', 'company.bs'], {
  label: 'Company',
  icon: 'building',
})

// Add actions
show.addBackAction({ route: 'jp_user' })
show.addAction({
  name: 'viewPosts',
  label: 'View Posts',
  icon: 'pi pi-file-edit',
  severity: 'info',
  onClick: () => router.push({ name: 'post', query: { userId: route.params.id } })
})

// Helper to get nested value from data
function getNestedValue(fieldName) {
  const data = show.data.value
  if (!data) return null
  const parts = fieldName.split('.')
  let value = data
  for (const part of parts) {
    value = value?.[part]
  }
  return value
}
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #nav>
      <PageNav />
    </template>

    <template #header-actions>
      <Button
        icon="pi pi-sync"
        label="Simulate a change made elsewhere"
        severity="secondary"
        size="small"
        @click="simulateRemoteChange"
      />
      <Button
        icon="pi pi-phone"
        label="Simulate a phone change made elsewhere"
        severity="secondary"
        size="small"
        @click="simulatePhoneChange"
      />
    </template>

    <template #fields>
      <!-- Field groups rendered as tabs with icons and badges -->
      <FieldGroups
        :groups="show.groups.value"
        :data="show.data.value"
        layout="tabs"
      >
        <template #field="{ field }">
          <ShowField
            :field="field"
            :value="getNestedValue(field.name)"
            horizontal
            label-width="120px"
          />
        </template>
      </FieldGroups>
    </template>
  </ShowPage>
</template>
