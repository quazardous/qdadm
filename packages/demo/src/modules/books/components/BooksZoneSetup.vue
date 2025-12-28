<script setup>
/**
 * BooksZoneSetup - Registers Books module zones and blocks
 *
 * This render-less component is included in the app layout to register
 * zone blocks when the Vue app mounts. It defines the extensible zones
 * that other modules (like Loans) can modify.
 *
 * ZONE PATTERN: Module-owned zones
 * =================================
 * Books module owns these zones:
 * - 'books-list-header': Header area on book list page
 * - 'books-detail-content': Content wrapper on book edit page
 *
 * Other modules can use replace/extend/wrap operations on these zones
 * to customize the Books UI without modifying Books module code.
 */
import { onMounted } from 'vue'
import { useZoneRegistry } from 'qdadm'
import BooksListHeader from './BooksListHeader.vue'
import BooksDetailPanel from './BooksDetailPanel.vue'

const { defineZone, registerBlock } = useZoneRegistry()

onMounted(() => {
  // Define zones owned by Books module
  defineZone('books-list-header')
  defineZone('books-detail-content')

  // Register default blocks in Books zones
  // These blocks have IDs so other modules can target them for replace/extend/wrap
  registerBlock('books-list-header', {
    id: 'books-header',
    component: BooksListHeader,
    weight: 50
  })

  registerBlock('books-detail-content', {
    id: 'books-detail',
    component: BooksDetailPanel,
    weight: 50
  })
})
</script>

<template>
  <!-- Render-less setup component -->
</template>
