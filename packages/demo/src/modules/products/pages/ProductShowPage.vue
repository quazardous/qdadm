<script setup>
/**
 * ProductShowPage - DummyJSON Product detail page using ShowPage builder
 *
 * Demonstrates the useEntityItemShowPage composable for read-only detail pages.
 * Features:
 * - Auto-generated fields from entity schema
 * - Custom field configuration for display formatting
 * - Edit and Back actions
 */
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from 'qdadm'

const show = useEntityItemShowPage({ entity: 'products' })

// Generate fields from schema
show.generateFields()

// Customize specific fields for better display
show.updateField('price', {
  type: 'currency',
  currencyCode: 'USD',
})

show.updateField('discountPercentage', {
  type: 'number',
  render: (v) => v ? `${Number(v).toFixed(1)}%` : '-',
})

show.updateField('rating', {
  type: 'number',
  render: (v) => v ? `${Number(v).toFixed(1)} / 5` : '-',
})

show.updateField('stock', {
  type: 'badge',
  severity: (v) => {
    if (!v || v === 0) return 'danger'
    if (Number(v) < 10) return 'warn'
    return 'success'
  },
  render: (v) => v && Number(v) > 0 ? `${v} in stock` : 'Out of stock',
})

show.updateField('thumbnail', {
  type: 'image',
  imageWidth: '200px',
  imageHeight: '150px',
})

show.updateField('category', {
  type: 'badge',
  severity: 'info',
})

show.updateField('description', {
  type: 'textarea',
})

// Add actions
show.addEditAction()
show.addBackAction()
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <ShowField
        v-for="f in show.fields.value"
        :key="f.name"
        :field="f"
        :value="show.data.value?.[f.name]"
        horizontal
        label-width="140px"
      />
    </template>
  </ShowPage>
</template>
