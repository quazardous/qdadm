<script setup lang="ts">
/**
 * QdActionButton - one action of an item page (#5444)
 *
 * A plain button; with `items`, a split button: the action's own button and,
 * joined on its right, a chevron zone opening a menu of related gestures.
 * Without `onClick`, one button that only opens the menu. The menu lines up
 * with the button (its right edge when the button sits right of the window's
 * middle, its left edge otherwise) and opens upwards when there is no room
 * below; it is appended to the body, so no card or footer cuts it.
 *
 * Keyboard: the chevron says what it opens (aria-haspopup, aria-expanded);
 * arrows move in the menu, Enter runs an entry, Escape closes it and gives
 * the focus back to the chevron.
 */
import { computed, nextTick, ref, useId } from 'vue'
import Menu from 'primevue/menu'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import type { ResolvedAction } from '../../composables/useEntityItemShowPage'

const props = defineProps<{ action: ResolvedAction }>()
const { tOr } = useI18n()

const split = computed(() => (props.action.items?.length ?? 0) > 0)
const menuOnly = computed(() => split.value && !props.action.onClick)
const group = ref<HTMLElement | null>(null)
const chevron = ref<{ $el?: HTMLElement } | null>(null)
const menu = ref<InstanceType<typeof Menu> | null>(null)
const open = ref(false)
const menuId = `qd-action-menu-${useId()}`
let shown: HTMLElement | null = null

const chevronLabel = computed(() => tOr('core.actions.moreActions', 'More actions: {action}', { action: props.action.label }))
const model = computed(() =>
  (props.action.items ?? []).map((i) => ({
    key: i.name,
    label: i.label,
    icon: i.icon,
    disabled: i.isDisabled,
    tooltip: i.tooltip,
    severity: i.severity,
    command: () => void i.onClick(),
  }))
)

function toggle(event: Event): void {
  // Anchored on the whole group: the menu is at least as wide, and flips by the room around it
  menu.value?.toggle(event, group.value ?? undefined)
}

/** Line the menu up with the button, inside the window */
function align(): void {
  open.value = true
  const box = group.value?.getBoundingClientRect()
  const el = (menu.value as unknown as { container?: HTMLElement } | null)?.container
  shown = el ?? null
  if (!box || !el) return
  const width = el.offsetWidth
  const vw = document.documentElement.clientWidth
  const rightAligned = box.left + box.width / 2 > vw / 2
  let left = rightAligned ? box.right - width : box.left
  left = Math.max(4, Math.min(left, vw - width - 4))
  el.style.left = `${left + window.scrollX}px`
  el.dataset.align = rightAligned ? 'end' : 'start'
}

function onHide(): void {
  open.value = false
  // The focus goes back to the chevron (or the menu-only button), never lost
  // on the body or in the closing menu; a click elsewhere keeps its own focus
  // The menu as shown (PrimeVue lets go of it on leave)
  const container = shown
  shown = null
  void nextTick(() => {
    const active = document.activeElement
    if (!active || active === document.body || group.value?.contains(active) || container?.contains(active) || !active.isConnected) chevron.value?.$el?.focus?.()
  })
}
</script>

<template>
  <!-- A plain button -->
  <template v-if="!split">
    <!-- A disabled button gets no mouse events: its tooltip goes on a focusable wrapper (#5436) -->
    <span v-if="action.isDisabled && action.tooltip" v-tooltip.top="action.tooltip" class="qd-action-tip" tabindex="0" :aria-label="action.tooltip" data-action-tip>
      <QdButton :label="action.label" :icon="action.icon" :severity="action.severity" :loading="action.isLoading" disabled :data-action="action.name" />
    </span>
    <QdButton
      v-else
      v-tooltip.top="action.tooltip"
      :label="action.label"
      :icon="action.icon"
      :severity="action.severity"
      :loading="action.isLoading"
      :disabled="action.isDisabled"
      :data-action="action.name"
      @click="action.onClick"
    />
  </template>

  <!-- A split button, or a menu-only one -->
  <span v-else ref="group" class="qd-split-action" :class="{ 'qd-split-action--menu': menuOnly }" role="group" :aria-label="action.label" :data-action="action.name">
    <template v-if="!menuOnly">
      <span v-if="action.isDisabled && action.tooltip" v-tooltip.top="action.tooltip" class="qd-action-tip qd-split-action-main" tabindex="0" :aria-label="action.tooltip" data-action-tip>
        <QdButton :label="action.label" :icon="action.icon" :severity="action.severity" :loading="action.isLoading" disabled data-action-main />
      </span>
      <QdButton
        v-else
        v-tooltip.top="action.tooltip"
        class="qd-split-action-main"
        :label="action.label"
        :icon="action.icon"
        :severity="action.severity"
        :loading="action.isLoading"
        :disabled="action.isDisabled"
        data-action-main
        @click="action.onClick"
      />
      <!-- Its chevron as content, not as an icon-only button: it takes the action's own look -->
      <QdButton
        ref="chevron"
        class="qd-split-action-chevron"
        :severity="action.severity"
        :aria-label="chevronLabel"
        aria-haspopup="menu"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="open ? menuId : undefined"
        data-action-chevron
        @click="toggle"
      >
        <span class="pi pi-chevron-down" aria-hidden="true"></span>
      </QdButton>
    </template>
    <QdButton
      v-else
      ref="chevron"
      v-tooltip.top="action.tooltip"
      class="qd-split-action-chevron"
      :severity="action.severity"
      :disabled="action.isDisabled"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="open ? menuId : undefined"
      data-action-chevron
      @click="toggle"
    >
      <span v-if="action.icon" :class="[action.icon, 'p-button-icon', 'p-button-icon-left']" aria-hidden="true"></span>
      <span class="p-button-label">{{ action.label }}</span>
      <span class="pi pi-chevron-down p-button-icon p-button-icon-right" aria-hidden="true"></span>
    </QdButton>
    <Menu :id="menuId" ref="menu" :model="model" popup class="qd-split-action-menu" @show="align" @hide="onHide">
      <template #item="{ item, props: itemProps }">
        <a v-bind="itemProps.action" :title="item.tooltip" :data-action-item="item.key" :data-severity="item.severity">
          <span v-if="item.icon" :class="[item.icon, 'p-menu-item-icon']" aria-hidden="true"></span>
          <span class="p-menu-item-label">{{ item.label }}</span>
        </a>
      </template>
    </Menu>
  </span>
</template>

<style>
/* A disabled action's tooltip, on a wrapper the pointer and the keyboard reach (#5436) */
.qd-action-tip {
  display: inline-flex;
  border-radius: 6px;
}
.qd-action-tip:focus-visible {
  outline: 2px solid var(--p-primary-color, #3b82f6);
  outline-offset: 2px;
}

/* The split button (#5444): the action's button, the chevron zone joined on its right */
.qd-split-action {
  display: inline-flex;
  align-items: stretch;
  vertical-align: middle;
}
.qd-split-action:not(.qd-split-action--menu) > .qd-split-action-main,
.qd-split-action:not(.qd-split-action--menu) > .qd-split-action-main > .p-button {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.qd-split-action:not(.qd-split-action--menu) > .qd-split-action-chevron {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  /* The two borders overlap: one thin line between the zones */
  margin-left: -1px;
  padding-inline: 0.6rem;
}
.qd-split-action-chevron .pi-chevron-down {
  font-size: 0.8em;
}
.qd-split-action--menu > .qd-split-action-chevron .p-button-icon-right {
  margin-left: 0.5rem;
  font-size: 0.75em;
}
.qd-split-action-menu [data-severity='danger'] {
  color: var(--p-red-600, #dc2626);
}
</style>
