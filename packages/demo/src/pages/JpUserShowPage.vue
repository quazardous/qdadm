<script setup>
/**
 * JpUserShowPage - JSONPlaceholder User detail page using ShowPage builder
 *
 * Demonstrates field groups with tabs layout, including icons and badges.
 */
import { computed } from 'vue'
import { useEntityItemShowPage, ShowPage, ShowField, FieldGroups, PageNav } from 'qdadm'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const show = useEntityItemShowPage({ entity: 'jp_users' })

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
