<script setup>
/**
 * BooksListHeader - Default header for Books list page
 *
 * This component is registered in the 'books-list-header' zone by the Books module.
 * Other modules (like Loans) can replace, extend, or wrap this component
 * using zone operations to demonstrate cross-module extensibility.
 *
 * @zone books-list-header - Main header zone for book list page
 */
import { computed } from 'vue'
import { useOrchestrator } from 'qdadm'

const { getManager } = useOrchestrator()
const booksManager = getManager('books')

const label = computed(() => booksManager.config.labelPlural || 'Books')
</script>

<template>
  <div class="books-list-header">
    <h2 class="text-xl font-semibold m-0">{{ label }} Catalog</h2>
    <p class="text-color-secondary mt-1 mb-0">Browse and manage your book collection</p>
  </div>
</template>
