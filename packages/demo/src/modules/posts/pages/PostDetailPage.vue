<script setup>
/**
 * PostDetailPage - JSONPlaceholder Post detail page
 *
 * Displays post details fetched from JSONPlaceholder API.
 * Features:
 * - Full post body content
 * - Link to author user
 * - Read-only view (JSONPlaceholder doesn't persist changes)
 */

import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PageLayout, usePageTitle, useOrchestrator } from 'qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'

const route = useRoute()
const router = useRouter()

// Get managers from orchestrator
const { getManager } = useOrchestrator()
const postsManager = getManager('posts')
const usersManager = getManager('jp_users')

// State
const post = ref(null)
const author = ref(null)
const loading = ref(false)
const error = ref(null)

// Page title
const pageTitle = computed(() => {
  if (post.value) {
    return post.value.title
  }
  return 'Post Details'
})

usePageTitle(pageTitle)

// Load post data
async function loadPost() {
  const postId = route.params.id
  if (!postId) {
    error.value = 'No post ID provided'
    return
  }

  loading.value = true
  error.value = null

  try {
    post.value = await postsManager.get(postId)
    if (!post.value) {
      error.value = 'Post not found'
      return
    }

    // Load author info
    if (post.value.userId) {
      author.value = await usersManager.get(post.value.userId)
    }
  } catch (err) {
    console.error('Failed to load post:', err)
    error.value = err.message || 'Failed to load post'
    post.value = null
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'post' })
}

function goToAuthor() {
  if (post.value?.userId) {
    router.push({ name: 'jp_user-show', params: { id: post.value.userId } })
  }
}

onMounted(() => {
  loadPost()
})
</script>

<template>
  <PageLayout>
    <div class="post-detail-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <Button
            icon="pi pi-arrow-left"
            severity="secondary"
            text
            rounded
            @click="goBack"
          />
          <h1>{{ pageTitle }}</h1>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      </div>

      <!-- Error State -->
      <Message v-else-if="error" severity="error" :closable="false">
        {{ error }}
      </Message>

      <!-- Post Details -->
      <Card v-else-if="post">
        <template #content>
          <div class="post-details">
            <div class="detail-row">
              <span class="detail-label">ID</span>
              <span class="detail-value">{{ post.id }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Title</span>
              <span class="detail-value">{{ post.title }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Author</span>
              <span class="detail-value">
                <Button
                  v-if="author"
                  :label="author.name || author.username"
                  link
                  class="p-0"
                  @click="goToAuthor"
                />
                <span v-else>User {{ post.userId }}</span>
              </span>
            </div>
            <div class="detail-row body-row">
              <span class="detail-label">Body</span>
              <div class="detail-value post-body">
                {{ post.body }}
              </div>
            </div>
          </div>

          <div class="detail-actions">
            <Button
              label="Back to List"
              icon="pi pi-arrow-left"
              severity="secondary"
              @click="goBack"
            />
          </div>
        </template>
      </Card>
    </div>
  </PageLayout>
</template>

<style scoped>
.post-detail-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  margin-bottom: 0.5rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-content h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.post-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  border-bottom: 1px solid var(--p-surface-200);
  padding-bottom: 0.75rem;
}

.detail-row:last-child {
  border-bottom: none;
}

.body-row {
  flex-direction: column;
  gap: 0.5rem;
}

.detail-label {
  font-weight: 600;
  color: var(--p-surface-600);
  min-width: 120px;
}

.detail-value {
  color: var(--p-surface-800);
}

.detail-value a {
  color: var(--p-primary-500);
  text-decoration: none;
}

.detail-value a:hover {
  text-decoration: underline;
}

.post-body {
  line-height: 1.6;
  white-space: pre-wrap;
}

.detail-actions {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200);
}
</style>
