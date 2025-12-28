<script setup>
/**
 * BooksDetailPanel - Content panel for book details/edit page
 *
 * This component displays book information and is registered in the
 * 'books-detail-content' zone. Other modules can wrap this component
 * to add contextual information (e.g., loan availability).
 *
 * @zone books-detail-content - Content area for book detail/edit pages
 */
defineProps({
  book: {
    type: Object,
    default: null
  }
})
</script>

<template>
  <div class="books-detail-panel">
    <slot />
  </div>
</template>
