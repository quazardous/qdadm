<script setup lang="ts">
/**
 * NavlinksGroup - the right-side navigation group of a breadcrumb bar (#1357)
 *
 * Single rendering of the contract previously copy-pasted between AppLayout's
 * inline breadcrumb and DefaultBreadcrumb: View↔Edit mode links LEAD the
 * group (#1332/#1341/#1353, order #j7udkh), sibling navlinks follow, pipe
 * separators between every pair, plain text (no icons).
 *
 * Owns the two behaviors both call sites need:
 * - the `qdadmFeatures.breadcrumbModeToggle` opt-in gate on mode links
 * - dedup (#1357): a navlink whose target route is already covered by a
 *   shown mode link is dropped — e.g. the auto "Details" link resolves to
 *   the parent's edit route and would render twice ("Details" + "Edit").
 *   With the feature off, no mode links are shown and every navlink stays
 *   (back-compat).
 *
 * `variant` keeps the historical CSS hooks of each call site so consumer
 * overrides keep working: 'layout' = AppLayout classes, 'breadcrumb' =
 * DefaultBreadcrumb classes.
 */
import { computed, inject } from 'vue'
import { RouterLink } from 'vue-router'
import type { NavLinkItem, BreadcrumbModeToggle } from '../../composables/useNavContext'

interface FeaturesConfig {
  breadcrumbModeToggle?: boolean
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    navlinks?: NavLinkItem[]
    modeLinks?: BreadcrumbModeToggle[]
    variant?: 'layout' | 'breadcrumb'
  }>(),
  {
    navlinks: () => [],
    modeLinks: () => [],
    variant: 'breadcrumb',
  }
)

const features = inject<FeaturesConfig>('qdadmFeatures', {})

// Opt-in (#1332): mode links render only when the feature flag is on
const shownModeLinks = computed<BreadcrumbModeToggle[]>(() =>
  features.breadcrumbModeToggle === true ? props.modeLinks : []
)

// Dedup (#1357): drop navlinks targeting a route a mode link already covers
const shownNavlinks = computed<NavLinkItem[]>(() => {
  if (shownModeLinks.value.length === 0) return props.navlinks
  const covered = new Set(shownModeLinks.value.map((m) => m.to.name))
  return props.navlinks.filter((link) => !link.to?.name || !covered.has(link.to.name))
})

const cls = computed(() =>
  props.variant === 'layout'
    ? {
        container: 'layout-navlinks',
        separator: 'layout-navlinks-separator',
        link: 'layout-navlink',
        active: 'layout-navlink--active',
      }
    : {
        container: 'breadcrumb-navlinks',
        separator: 'navlinks-separator',
        link: 'navlink',
        active: 'navlink--active',
      }
)
</script>

<template>
  <!-- Plain navigation; the form page's own route-leave guard covers
       unsaved changes on edit→show -->
  <div v-if="shownNavlinks.length > 0 || shownModeLinks.length > 0" :class="cls.container">
    <!-- mode links lead the group (#j7udkh), sibling tabs follow -->
    <template v-for="(mode, index) in shownModeLinks" :key="`mode-${mode.target}`">
      <span v-if="index > 0" :class="cls.separator">|</span>
      <RouterLink :to="mode.to" class="breadcrumb-mode-toggle" :class="cls.link">
        {{ mode.label }}
      </RouterLink>
    </template>
    <template v-for="(link, index) in shownNavlinks" :key="link.to?.name || index">
      <span v-if="shownModeLinks.length > 0 || index > 0" :class="cls.separator">|</span>
      <RouterLink :to="link.to" :class="[cls.link, { [cls.active]: link.active }]">
        {{ link.label }}
      </RouterLink>
    </template>
  </div>
</template>

<style scoped>
/* Historical styles of each call site, keyed by variant container so the
   look of both bars is preserved exactly (AppLayout was compact). */
.layout-navlinks {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--fad-font-size-sm);
}

.layout-navlinks-separator {
  color: var(--p-surface-400, #94a3b8);
  opacity: 0.5;
}

.layout-navlink {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  transition: color var(--fad-transition-fast);
}

.layout-navlink:hover {
  color: var(--p-primary-600, #2563eb);
}

.layout-navlink--active {
  color: var(--p-surface-600, #475569);
  font-weight: var(--fad-font-weight-medium);
  pointer-events: none;
}

.breadcrumb-navlinks {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.navlinks-separator {
  color: var(--p-surface-400, #94a3b8);
}

.navlink {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  transition: color 0.15s;
}

.navlink:hover {
  color: var(--p-primary-700, #1d4ed8);
  text-decoration: underline;
}

.navlink--active {
  color: var(--p-surface-700, #334155);
  font-weight: 500;
  pointer-events: none;
}
</style>
