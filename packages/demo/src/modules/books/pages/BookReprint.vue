<script setup>
/**
 * BookReprint - a child page that acts (#4962)
 *
 * Declared with `permission: 'entity:books:update'` on top of the book's read
 * right: PageNav hides its link from read-only users, the guard refuses them.
 */
import { useChildPage, PageLayout, PageNav } from '@quazardous/qdadm'

const { parentData: book } = useChildPage()
</script>

<template>
  <PageLayout title="Reprint">
    <template #nav>
      <PageNav />
    </template>
    <p v-if="book">Order a reprint of <strong>{{ book.title }}</strong>. Only editors see this page.</p>
  </PageLayout>
</template>
