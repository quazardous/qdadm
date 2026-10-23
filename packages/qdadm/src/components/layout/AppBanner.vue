<script setup lang="ts">
/**
 * AppBanner - the strip above the layout (#4200)
 *
 * Shows the `useAppBanner()` messages one at a time, full width, fixed at the
 * top. Its height goes to `--qd-banner-height` on <html>, which AppLayout,
 * BaseLayout and LoginPage read to start below it: nothing is covered. With
 * no message, there is no strip and the variable is 0.
 *
 * Rendered by AppLayout, BaseLayout and LoginPage; a page outside them can
 * place one too. The default slot replaces the text of the message shown.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAppBanner, type AppBannerMessage, type AppBannerSeverity } from '../../composables/useAppBanner'
import { isExternalUserLink } from '../../composables/useUserBox'
import { useI18n } from '../../i18n/useI18n'

const HEIGHT_VAR = '--qd-banner-height'

const ICONS: Record<AppBannerSeverity, string> = {
  info: 'pi pi-info-circle',
  success: 'pi pi-check-circle',
  warn: 'pi pi-exclamation-triangle',
  error: 'pi pi-exclamation-circle',
}

const { messages, dismiss } = useAppBanner()
const { tOr } = useI18n()

const index = ref(0)
// Until the user pages, the first message shows (a new urgent one included);
// once they have, the strip stays on the message they chose
const chosen = ref(false)
const currentKey = ref<string | null>(null)
watch(
  messages,
  (list) => {
    const kept = chosen.value ? list.findIndex((e) => e.key === currentKey.value) : 0
    index.value = kept >= 0 ? kept : Math.min(index.value, Math.max(list.length - 1, 0))
    currentKey.value = list[index.value]?.key ?? null
  },
  { immediate: true }
)

const current = computed<AppBannerMessage | null>(() => messages.value[index.value]?.message ?? null)
const severity = computed<AppBannerSeverity>(() => current.value?.severity ?? 'info')
const icon = computed(() => (current.value?.icon === false ? null : current.value?.icon || ICONS[severity.value]))
const external = computed(() => isExternalUserLink(current.value?.link?.href))

function go(step: number) {
  const count = messages.value.length
  chosen.value = true
  index.value = (index.value + step + count) % count
  currentKey.value = messages.value[index.value]?.key ?? null
}

function close() {
  if (!current.value) return
  // The next message takes this index; past the end, back to the first
  const next = messages.value[index.value + 1] ?? messages.value[0]
  currentKey.value = next && next.message !== current.value ? next.key : null
  dismiss(current.value)
}

// The layout's offset: the strip's real height, wrapped text included
const el = ref<HTMLElement | null>(null)
const setHeight = (px: number) => document.documentElement.style.setProperty(HEIGHT_VAR, `${px}px`)
let observer: ResizeObserver | null = null
watch(el, (node) => {
  observer?.disconnect()
  observer = null
  if (!node) return setHeight(0)
  setHeight(node.offsetHeight)
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(() => setHeight(node.offsetHeight))
  observer.observe(node)
}, { immediate: true })
onBeforeUnmount(() => {
  observer?.disconnect()
  setHeight(0)
})
</script>

<template>
  <div
    v-if="current"
    ref="el"
    class="qd-app-banner"
    :class="`qd-app-banner--${severity}`"
    role="status"
    :aria-label="tOr('core.banner.label', 'Environment notice')"
  >
    <div v-if="messages.length > 1" class="qd-app-banner-nav">
      <button type="button" class="qd-app-banner-btn" :aria-label="tOr('core.banner.previous', 'Previous message')" @click="go(-1)">
        <i class="pi pi-chevron-left" />
      </button>
      <span class="qd-app-banner-position" :aria-label="tOr('core.banner.position', '{index} of {count}', { index: index + 1, count: messages.length })">
        {{ index + 1 }}/{{ messages.length }}
      </span>
      <button type="button" class="qd-app-banner-btn" :aria-label="tOr('core.banner.next', 'Next message')" @click="go(1)">
        <i class="pi pi-chevron-right" />
      </button>
    </div>
    <div class="qd-app-banner-message">
      <i v-if="icon" :class="icon" class="qd-app-banner-icon" aria-hidden="true" />
      <span class="qd-app-banner-text">
        <slot :message="current">{{ current.text }}</slot>
        <a
          v-if="current.link"
          class="qd-app-banner-link"
          :href="current.link.href"
          v-bind="external ? { target: '_blank', rel: 'noopener noreferrer' } : {}"
        >{{ current.link.label }}</a>
      </span>
    </div>
    <button
      v-if="current.closable"
      type="button"
      class="qd-app-banner-btn qd-app-banner-close"
      :aria-label="tOr('core.banner.close', 'Close this message')"
      @click="close"
    >
      <i class="pi pi-times" />
    </button>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.qd-app-banner {
  --qd-banner-bg: var(--p-primary-color, #3b82f6);
  --qd-banner-fg: var(--p-primary-contrast-color, #fff);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* Above the sidebar (100), below PrimeVue overlays and dialogs (1000+) */
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 1rem;
  /* The height of a button row: paging or closing doesn't move the layout */
  min-height: 2.2rem;
  box-sizing: border-box;
  background: var(--qd-banner-bg);
  color: var(--qd-banner-fg);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
}

.qd-app-banner--success {
  --qd-banner-bg: var(--p-green-600, #16a34a);
  --qd-banner-fg: #fff;
}

.qd-app-banner--warn {
  --qd-banner-bg: var(--p-amber-400, #fbbf24);
  --qd-banner-fg: var(--p-amber-950, #451a03);
}

.qd-app-banner--error {
  --qd-banner-bg: var(--p-red-600, #dc2626);
  --qd-banner-fg: #fff;
}

.qd-app-banner-message {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
}

.qd-app-banner-text {
  overflow-wrap: anywhere;
}

.qd-app-banner-link {
  margin-left: 0.5rem;
  color: inherit;
  text-decoration: underline;
}

.qd-app-banner-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.qd-app-banner-position {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.qd-app-banner-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  flex-shrink: 0;
}

.qd-app-banner-btn:hover,
.qd-app-banner-btn:focus-visible {
  background: color-mix(in srgb, currentColor 18%, transparent);
}

.qd-app-banner-btn .pi {
  font-size: 0.75rem;
}
</style>
