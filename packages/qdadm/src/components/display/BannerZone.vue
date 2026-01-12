<script setup lang="ts">
/**
 * BannerZone - Renders programmatic banners from useInfoBanner
 *
 * Place this component where you want banners to appear (typically
 * at the top of page content).
 *
 * @example
 * <template>
 *   <div class="page-content">
 *     <BannerZone />
 *     <!-- rest of page content -->
 *   </div>
 * </template>
 */
import { useInfoBanner } from '../../composables/useInfoBanner'
import InfoBanner from '../InfoBanner.vue'

const { banners, hideBanner } = useInfoBanner()
</script>

<template>
  <TransitionGroup name="banner" tag="div" class="banner-zone">
    <InfoBanner
      v-for="banner in banners"
      :key="banner.id"
      :severity="banner.severity"
      :icon="banner.icon"
      :closable="banner.closable"
      @close="hideBanner(banner.id)"
    >
      <span v-html="banner.message"></span>
    </InfoBanner>
  </TransitionGroup>
</template>

<style scoped>
.banner-zone {
  position: relative;
}

/* Transition animations */
.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
}

.banner-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.banner-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.banner-move {
  transition: transform 0.3s ease;
}
</style>
