<script setup lang="ts">
/**
 * InfoBanner - Consistent message banner component
 *
 * Wraps PrimeVue Message with standardized styling and icon support.
 *
 * @example
 * // Simple usage
 * <InfoBanner severity="warn">
 *   Settings will be lost on refresh.
 * </InfoBanner>
 *
 * // With custom icon
 * <InfoBanner severity="success" icon="pi-check-circle">
 *   Operation completed successfully.
 * </InfoBanner>
 *
 * // Without icon
 * <InfoBanner severity="info" :icon="false">
 *   Just some information.
 * </InfoBanner>
 */
import Message from 'primevue/message'
import { computed } from 'vue'

type Severity = 'info' | 'success' | 'warn' | 'error' | 'secondary' | 'contrast'

interface Props {
  /** Severity level: info, success, warn, error, secondary, contrast */
  severity?: Severity
  /** Custom icon class (e.g., 'pi-user'). Set to false to hide icon. */
  icon?: string | boolean | null
  /** Allow closing the banner (default: true) */
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'info',
  icon: null,
  closable: true
})

// Default icons per severity
const defaultIcons: Record<Severity, string> = {
  info: 'pi-info-circle',
  success: 'pi-check-circle',
  warn: 'pi-exclamation-triangle',
  error: 'pi-times-circle',
  secondary: 'pi-info-circle',
  contrast: 'pi-info-circle'
}

const iconClass = computed(() => {
  if (props.icon === false) return null
  if (props.icon && typeof props.icon === 'string') return `pi ${props.icon}`
  return `pi ${defaultIcons[props.severity]}`
})
</script>

<template>
  <Message
    :severity="severity"
    :closable="closable"
    class="info-banner"
  >
    <div class="info-banner-content">
      <i v-if="iconClass" :class="iconClass" class="info-banner-icon"></i>
      <span class="info-banner-text">
        <slot />
      </span>
    </div>
  </Message>
</template>

<style scoped>
.info-banner-content {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.info-banner-icon {
  font-size: 1.125rem;
  flex-shrink: 0;
}

.info-banner-text {
  flex: 1;
}

.info-banner-text :deep(strong) {
  font-weight: 600;
}
</style>
