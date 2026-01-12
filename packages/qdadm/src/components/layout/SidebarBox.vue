<script setup lang="ts">
/**
 * SidebarBox - Reusable sidebar footer item component
 *
 * Provides consistent structure for icon + text boxes in the sidebar.
 * Used for user info, impersonation, powered-by, etc.
 *
 * Props:
 *   - icon: PrimeIcons class (e.g., "pi-user") OR slot for custom content
 *   - title: Primary text
 *   - subtitle: Secondary text (optional)
 *   - variant: Color variant ('default' | 'impersonator')
 *
 * Slots:
 *   - icon: Custom icon content (overrides icon prop)
 *   - subtitle-content: Custom subtitle content (overrides subtitle prop)
 *   - default: Extra content after text (e.g., logout button)
 *   - full: Full-width content (bypasses icon+text structure, for controls/dropdowns)
 *
 * Usage:
 *   <SidebarBox icon="pi-user" title="John" subtitle="Admin" />
 *   <SidebarBox variant="impersonator" title="Impersonating" subtitle="bob" />
 *   <SidebarBox>
 *     <template #icon><img src="logo.svg" /></template>
 *     <template #subtitle-content>powered by qdadm</template>
 *   </SidebarBox>
 *   <SidebarBox>
 *     <template #full>
 *       <label>Impersonate</label>
 *       <AutoComplete ... />
 *     </template>
 *   </SidebarBox>
 */

import { useSlots, computed, type ComputedRef } from 'vue'

type SidebarBoxVariant = 'default' | 'impersonator'

interface Props {
  icon?: string | null
  title?: string
  subtitle?: string
  variant?: SidebarBoxVariant
}

withDefaults(defineProps<Props>(), {
  icon: null,
  title: '',
  subtitle: '',
  variant: 'default'
})

const slots = useSlots()
const hasFullSlot: ComputedRef<boolean> = computed(() => !!slots.full)
</script>

<template>
  <div
    class="sidebar-box"
    :class="{
      'sidebar-box--impersonator': variant === 'impersonator',
      'sidebar-box--full': hasFullSlot
    }"
  >
    <!-- Full-width mode (for controls/dropdowns) -->
    <div v-if="hasFullSlot" class="sidebar-box-full">
      <slot name="full"></slot>
    </div>

    <!-- Standard icon + text mode -->
    <div v-else class="sidebar-box-inner">
      <div class="sidebar-box-icon">
        <slot name="icon">
          <i v-if="icon" :class="['pi', icon]"></i>
        </slot>
      </div>
      <div class="sidebar-box-content">
        <div v-if="title" class="sidebar-box-title">{{ title }}</div>
        <div v-if="subtitle" class="sidebar-box-subtitle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </div>
        <slot name="subtitle-content"></slot>
      </div>
      <slot></slot>
    </div>
  </div>
</template>
