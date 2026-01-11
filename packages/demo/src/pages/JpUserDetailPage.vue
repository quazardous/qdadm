<script setup>
/**
 * JpUserDetailPage - JSONPlaceholder User detail page
 *
 * Displays user details fetched from JSONPlaceholder API.
 * Read-only view since JSONPlaceholder doesn't persist changes.
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PageLayout, usePageTitle, useEntityItemPage } from 'qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { InfoBanner } from 'qdadm/components'

const route = useRoute()
const router = useRouter()

// Use useEntityItemPage for user loading + breadcrumb
const { data: user, loading, error } = useEntityItemPage({ entity: 'jp_users' })

// Page title
const pageTitle = computed(() => {
  if (user.value) {
    return `User: ${user.value.name}`
  }
  return 'User Details'
})

usePageTitle(pageTitle)

function goBack() {
  router.push({ name: 'jp_user' })
}

function viewPosts() {
  router.push({ name: 'post', query: { userId: route.params.id } })
}
</script>

<template>
  <PageLayout>
    <div class="user-detail-page">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      </div>

      <!-- Error State -->
      <InfoBanner v-else-if="error" severity="error" :closable="false">
        {{ error }}
      </InfoBanner>

      <!-- User Details -->
      <Card v-else-if="user">
        <template #content>
          <div class="user-details">
            <div class="detail-row">
              <span class="detail-label">ID</span>
              <span class="detail-value">{{ user.id }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Full Name</span>
              <span class="detail-value">{{ user.name }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Username</span>
              <span class="detail-value">{{ user.username }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email</span>
              <span class="detail-value">
                <a :href="'mailto:' + user.email">{{ user.email }}</a>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Phone</span>
              <span class="detail-value">{{ user.phone || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Website</span>
              <span class="detail-value">
                <a v-if="user.website" :href="'https://' + user.website" target="_blank">
                  {{ user.website }}
                </a>
                <span v-else>-</span>
              </span>
            </div>

            <!-- Address Section -->
            <div v-if="user.address" class="detail-section">
              <h3 class="section-title">Address</h3>
              <div class="detail-row">
                <span class="detail-label">Street</span>
                <span class="detail-value">{{ user.address.street }}, {{ user.address.suite }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">City</span>
                <span class="detail-value">{{ user.address.city }} {{ user.address.zipcode }}</span>
              </div>
            </div>

            <!-- Company Section -->
            <div v-if="user.company" class="detail-section">
              <h3 class="section-title">Company</h3>
              <div class="detail-row">
                <span class="detail-label">Name</span>
                <span class="detail-value">{{ user.company.name }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Catchphrase</span>
                <span class="detail-value">{{ user.company.catchPhrase }}</span>
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
            <Button
              label="View Posts"
              icon="pi pi-file-edit"
              severity="info"
              @click="viewPosts"
            />
          </div>
        </template>
      </Card>
    </div>
  </PageLayout>
</template>

<style scoped>
.user-detail-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.user-details {
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

.detail-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-surface-700);
  margin: 0 0 1rem 0;
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200);
}
</style>
