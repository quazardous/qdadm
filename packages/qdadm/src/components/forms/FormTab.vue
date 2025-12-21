<script setup>
/**
 * FormTab - Normalized tab header component
 *
 * Provides consistent tab headers with optional icon, count badge, and visibility control.
 *
 * Props:
 *   - value: Tab identifier (required)
 *   - label: Display text (required)
 *   - icon: PrimeIcon class (e.g., 'pi-cog')
 *   - count: Number to display as badge
 *   - badge: Custom badge text/value
 *   - badgeSeverity: Badge color ('secondary', 'info', 'success', 'warn', 'danger')
 *   - visible: Show/hide tab (default: true)
 *   - disabled: Disable tab interaction
 *
 * Usage:
 *   <FormTab value="general" label="General" icon="pi-cog" />
 *   <FormTab value="items" label="Items" :count="5" />
 *   <FormTab value="errors" label="Errors" :count="errors.length" badge-severity="danger" />
 *   <FormTab value="advanced" label="Advanced" :visible="isEdit" />
 */

import Tab from 'primevue/tab'
import Tag from 'primevue/tag'

const props = defineProps({
  /**
   * Tab identifier (used for v-model matching)
   */
  value: {
    type: String,
    required: true
  },

  /**
   * Display label
   */
  label: {
    type: String,
    required: true
  },

  /**
   * PrimeIcon class (without 'pi' prefix or with full class)
   * Examples: 'pi-cog', 'cog', 'pi pi-cog'
   */
  icon: {
    type: String,
    default: null
  },

  /**
   * Count to display as badge (shows only if > 0)
   */
  count: {
    type: Number,
    default: null
  },

  /**
   * Custom badge text (alternative to count)
   */
  badge: {
    type: [String, Number],
    default: null
  },

  /**
   * Badge severity/color
   */
  badgeSeverity: {
    type: String,
    default: 'secondary',
    validator: (v) => ['secondary', 'info', 'success', 'warn', 'danger', 'contrast'].includes(v)
  },

  /**
   * Show/hide the tab
   */
  visible: {
    type: Boolean,
    default: true
  },

  /**
   * Disable tab interaction
   */
  disabled: {
    type: Boolean,
    default: false
  }
})

/**
 * Normalize icon class
 */
function getIconClass() {
  if (!props.icon) return null
  // Already has 'pi' prefix
  if (props.icon.startsWith('pi')) {
    return props.icon.includes(' ') ? props.icon : `pi ${props.icon}`
  }
  // Just icon name
  return `pi pi-${props.icon}`
}

/**
 * Get count value to display
 */
function getCountValue() {
  if (props.count !== null && props.count > 0) return props.count
  return null
}

/**
 * Get badge value to display (separate from count)
 */
function getBadgeValue() {
  if (props.badge !== null) return props.badge
  // If no badge but count provided, show count as badge (legacy behavior)
  if (props.count !== null && props.count > 0 && props.badge === null) return props.count
  return null
}

/**
 * Check if we should show count and badge separately
 */
function showBothCountAndBadge() {
  return props.count !== null && props.count > 0 && props.badge !== null
}
</script>

<template>
  <Tab
    v-if="visible"
    :value="value"
    :disabled="disabled"
  >
    <i v-if="icon" :class="getIconClass()" class="tab-icon" ></i>
    <span class="tab-label">{{ label }}</span>
    <!-- When both count and badge are provided, show count first then badge indicator -->
    <template v-if="showBothCountAndBadge()">
      <Tag
        :value="String(getCountValue())"
        severity="secondary"
        class="tab-badge"
      />
      <span class="tab-alert-dot" :class="`alert-${badgeSeverity}`"></span>
    </template>
    <!-- Otherwise show single badge (legacy behavior) -->
    <Tag
      v-else-if="getBadgeValue() !== null"
      :value="String(getBadgeValue())"
      :severity="badgeSeverity"
      class="tab-badge"
    />
  </Tab>
</template>

<style scoped>
.tab-icon {
  margin-right: 0.5rem;
}

.tab-label {
  /* Ensure consistent text rendering */
}

.tab-badge {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  min-width: 1.25rem;
  text-align: center;
}

.tab-alert-dot {
  display: inline-block;
  width: 8px !important;
  height: 8px !important;
  min-width: 8px;
  max-width: 8px;
  border-radius: 50%;
  margin-left: 0.35rem;
  animation: pulse 1.5s infinite;
}

.alert-warn {
  background-color: var(--p-orange-500);
}

.alert-danger {
  background-color: var(--p-red-500);
}

.alert-info {
  background-color: var(--p-blue-500);
}

.alert-success {
  background-color: var(--p-green-500);
}

.alert-secondary {
  background-color: var(--p-gray-500);
}

.alert-contrast {
  background-color: var(--p-primary-500);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
