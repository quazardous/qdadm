<script setup>
/**
 * ProductsPage - DummyJSON Products list page
 *
 * Displays products fetched from DummyJSON API.
 * Features:
 * - Server-side pagination with limit/skip
 * - Product thumbnails
 * - Price and category display
 * - View product detail action
 *
 * Note: DummyJSON is read-only.
 */

import { useListPageBuilder, ListPage } from 'qdadm'
import Column from 'primevue/column'
import { useFavoriteAction } from '@/composables/useFavoriteAction'

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'products' })

// ============ FAVORITE ACTION ============
useFavoriteAction(list, 'product', { labelField: 'title' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search products...',
  fields: ['title', 'category']
})

// ============ ROW ACTIONS ============
list.addViewAction()

// ============ PRICE FORMATTING ============
function formatPrice(price) {
  if (typeof price !== 'number') return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price)
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column header="Image" style="width: 80px">
        <template #body="{ data }">
          <img
            v-if="data.thumbnail"
            :src="data.thumbnail"
            :alt="data.title"
            class="product-thumbnail"
          />
        </template>
      </Column>
      <Column field="title" header="Title" sortable />
      <Column field="price" header="Price" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatPrice(data.price) }}
        </template>
      </Column>
      <Column field="category" header="Category" sortable style="width: 150px" />
    </template>
  </ListPage>
</template>

<style scoped>
.product-thumbnail {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}
</style>
