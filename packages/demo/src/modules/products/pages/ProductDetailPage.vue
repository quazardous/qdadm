<script setup>
/**
 * ProductDetailPage - DummyJSON Product detail page
 *
 * Displays product details fetched from DummyJSON API.
 * Features:
 * - Full product information
 * - Product images gallery
 * - Price with discount
 * - Rating and stock info
 * - Read-only view (DummyJSON doesn't persist changes)
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { PageLayout, usePageTitle, useEntityItemPage } from 'qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { InfoBanner } from 'qdadm/components'
import Tag from 'primevue/tag'
import Rating from 'primevue/rating'

const router = useRouter()

// Use useEntityItemPage for product loading + breadcrumb
const { data: product, loading, error } = useEntityItemPage({ entity: 'products' })

// Page title
const pageTitle = computed(() => {
  if (product.value) {
    return product.value.title
  }
  return 'Product Details'
})

usePageTitle(pageTitle)

function goBack() {
  router.push({ name: 'product' })
}

function formatPrice(price) {
  if (typeof price !== 'number') return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price)
}

function getDiscountedPrice(price, discountPercentage) {
  if (typeof price !== 'number') return null
  const discount = discountPercentage || 0
  return price * (1 - discount / 100)
}

function getStockSeverity(stock) {
  if (!stock || stock === 0) return 'danger'
  if (stock < 10) return 'warn'
  return 'success'
}
</script>

<template>
  <PageLayout>
    <div class="product-detail-page">
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
      <InfoBanner v-else-if="error" severity="error">
        {{ error }}
      </InfoBanner>

      <!-- Product Details -->
      <div v-else-if="product" class="product-content">
        <!-- Main Info Card -->
        <Card>
          <template #content>
            <div class="product-main">
              <!-- Images -->
              <div class="product-images">
                <img
                  :src="product.thumbnail"
                  :alt="product.title"
                  class="main-image"
                />
                <div v-if="product.images?.length > 1" class="image-gallery">
                  <img
                    v-for="(img, idx) in product.images.slice(0, 4)"
                    :key="idx"
                    :src="img"
                    :alt="`${product.title} - ${idx + 1}`"
                    class="gallery-image"
                  />
                </div>
              </div>

              <!-- Details -->
              <div class="product-info">
                <div class="detail-row">
                  <span class="detail-label">ID</span>
                  <span class="detail-value">{{ product.id }}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Title</span>
                  <span class="detail-value">{{ product.title }}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Brand</span>
                  <span class="detail-value">{{ product.brand || '-' }}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Category</span>
                  <Tag :value="product.category" severity="info" />
                </div>

                <div class="detail-row">
                  <span class="detail-label">Price</span>
                  <span class="detail-value price-section">
                    <span v-if="product.discountPercentage" class="original-price">
                      {{ formatPrice(product.price) }}
                    </span>
                    <span class="current-price">
                      {{ formatPrice(getDiscountedPrice(product.price, product.discountPercentage)) }}
                    </span>
                    <Tag
                      v-if="product.discountPercentage"
                      :value="`-${product.discountPercentage.toFixed(0)}%`"
                      severity="success"
                    />
                  </span>
                </div>

                <div v-if="product.rating" class="detail-row">
                  <span class="detail-label">Rating</span>
                  <span class="detail-value rating-section">
                    <Rating :modelValue="product.rating" readonly :cancel="false" />
                    <span class="rating-text">({{ product.rating.toFixed(1) }})</span>
                  </span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Stock</span>
                  <Tag
                    :value="product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'"
                    :severity="getStockSeverity(product.stock)"
                  />
                </div>

                <div v-if="product.description" class="detail-row description-row">
                  <span class="detail-label">Description</span>
                  <p class="detail-value description-text">{{ product.description }}</p>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Additional Info Card -->
        <Card v-if="product.warrantyInformation || product.shippingInformation || product.returnPolicy" class="info-card">
          <template #title>Additional Information</template>
          <template #content>
            <div class="additional-info">
              <div v-if="product.warrantyInformation" class="info-item">
                <i class="pi pi-shield"></i>
                <span>{{ product.warrantyInformation }}</span>
              </div>
              <div v-if="product.shippingInformation" class="info-item">
                <i class="pi pi-truck"></i>
                <span>{{ product.shippingInformation }}</span>
              </div>
              <div v-if="product.returnPolicy" class="info-item">
                <i class="pi pi-replay"></i>
                <span>{{ product.returnPolicy }}</span>
              </div>
            </div>
          </template>
        </Card>

        <div class="detail-actions">
          <Button
            label="Back to List"
            icon="pi pi-arrow-left"
            severity="secondary"
            @click="goBack"
          />
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.product-detail-page {
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

.product-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-main {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
}

@media (max-width: 768px) {
  .product-main {
    grid-template-columns: 1fr;
  }
}

.product-images {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.main-image {
  width: 100%;
  max-width: 300px;
  border-radius: 8px;
  object-fit: cover;
}

.image-gallery {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.gallery-image {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  object-fit: cover;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.gallery-image:hover {
  border-color: var(--p-primary-500);
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  border-bottom: 1px solid var(--p-surface-200);
  padding-bottom: 0.75rem;
}

.detail-row:last-child {
  border-bottom: none;
}

.description-row {
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

.price-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.original-price {
  text-decoration: line-through;
  color: var(--p-surface-400);
  font-size: 0.9rem;
}

.current-price {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-primary-600);
}

.rating-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rating-text {
  color: var(--p-surface-500);
  font-size: 0.9rem;
}

.description-text {
  margin: 0;
  line-height: 1.6;
}

.info-card {
  margin-top: 0.5rem;
}

.additional-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--p-surface-700);
}

.info-item i {
  color: var(--p-primary-500);
  font-size: 1.1rem;
}

.detail-actions {
  margin-top: 0.5rem;
}
</style>
