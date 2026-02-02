<script setup lang="ts">
/**
 * FormTab - Normalized tab header component
 *
 * @deprecated Use FieldGroups with layout="tabs" instead. FieldGroups now supports
 * icon, badge, count, visible, and disabled options on groups.
 *
 * ```ts
 * // Before (deprecated)
 * <FormTab value="general" label="General" icon="pi-cog" :count="5" />
 *
 * // After (recommended)
 * form.group('general', ['field1'], { label: 'General', icon: 'cog', count: 5 })
 * ```
 */

import { type PropType } from 'vue'
import Tab from 'primevue/tab'
import Tag from 'primevue/tag'

type BadgeSeverity = 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast'

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
    type: String as () => string | null,
    default: null
  },

  /**
   * Count to display as badge (shows only if > 0)
   */
  count: {
    type: Number as () => number | null,
    default: null
  },

  /**
   * Custom badge text (alternative to count)
   */
  badge: {
    type: [String, Number] as unknown as PropType<string | number | null>,
    default: null
  },

  /**
   * Badge severity/color
   */
  badgeSeverity: {
    type: String as () => BadgeSeverity,
    default: 'secondary',
    validator: (v: string) => ['secondary', 'info', 'success', 'warn', 'danger', 'contrast'].includes(v)
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
function getIconClass(): string | null {
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
function getCountValue(): number | null {
  if (props.count !== null && props.count > 0) return props.count
  return null
}

/**
 * Get badge value to display (separate from count)
 */
function getBadgeValue(): string | number | null {
  if (props.badge !== null) return props.badge
  // If no badge but count provided, show count as badge (legacy behavior)
  if (props.count !== null && props.count > 0 && props.badge === null) return props.count
  return null
}

/**
 * Check if we should show count and badge separately
 */
function showBothCountAndBadge(): boolean {
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
