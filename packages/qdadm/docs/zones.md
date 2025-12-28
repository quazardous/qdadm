# Zones & Blocks

UI composition system inspired by Twig/Symfony.

## Problem

How to let modules extend or customize UI without modifying original components?

**Without zones:**
```vue
<!-- BooksList.vue - must import and hardcode extensions -->
<template>
  <LoanStatusBanner />  <!-- tight coupling to Loans module -->
  <BooksTable />
  <LoanWarning />       <!-- more coupling -->
</template>
```

Every extension requires editing the original file.

**With zones:**
```vue
<!-- BooksList.vue - defines extension points -->
<template>
  <Zone name="books-list-header" />
  <BooksTable />
  <Zone name="books-list-footer" />
</template>
```

Modules register blocks without touching BooksList.vue.

## Concepts

| Term | Definition | Example |
|------|------------|---------|
| **Zone** | Named slot in a layout (WHERE) | `books-list-header` |
| **Block** | Component that fills a zone (WHAT) | `LoanStatusBanner` |
| **Weight** | Order within a zone (lower = first) | `50` (default) |
| **ID** | Unique identifier for targeting | `loans-status-extension` |

## Basic Usage

### Define a Zone

```vue
<!-- In your layout/page component -->
<script setup>
import { Zone } from 'qdadm'
</script>

<template>
  <div class="page">
    <Zone name="page-header" />
    <div class="content">
      <slot />
    </div>
    <Zone name="page-footer" />
  </div>
</template>
```

### Register a Block

**Preferred: Module init** (receives `zones` from kernel):

```js
// modules/mymodule/init.js
import { defineAsyncComponent } from 'vue'

// IMPORTANT: Use defineAsyncComponent for lazy loading!
// Static imports would execute <script setup> before Vue app exists,
// causing silent failures if components use inject() or composables.
const MyBanner = defineAsyncComponent(() => import('./components/MyBanner.vue'))

export function init({ registry, zones }) {
  zones.registerBlock('page-header', {
    id: 'my-banner',
    component: MyBanner,
    weight: 50
  })
}
```

**Alternative: Composable** (for dynamic registration in components):

```js
import { useZoneRegistry } from 'qdadm'

const { registerBlock } = useZoneRegistry()

registerBlock('page-header', {
  id: 'my-banner',
  component: MyBanner,
  weight: 50,
  props: { variant: 'compact' }
})
```

## Operations

Four ways to add blocks to zones:

### 1. Add (default)

Insert block into zone, sorted by weight.

```js
registerBlock('header', {
  component: Logo,
  weight: 10,
  id: 'logo'
})

registerBlock('header', {
  component: UserMenu,
  weight: 90,
  id: 'user-menu'
})
// Result: [Logo, UserMenu] (sorted by weight)
```

### 2. Replace

Substitute an existing block entirely.

```js
// Books module registers header
registerBlock('books-list-header', {
  component: BooksHeader,
  weight: 50,
  id: 'books-header'
})

// Loans module REPLACES it with loan-aware version
registerBlock('books-list-header', {
  component: LoanAwareBooksHeader,
  weight: 60,
  id: 'loans-header-replacement',
  operation: 'replace',
  replaces: 'books-header'  // target block ID
})
```

Use when you need to completely change a block's behavior.

### 3. Extend

Insert content before or after an existing block.

```js
// Add warning banner AFTER the header
registerBlock('books-list-header', {
  component: LoanStatusBanner,
  weight: 70,
  id: 'loans-status-extension',
  operation: 'extend',
  after: 'books-header'  // or 'before'
})
```

Use when you want to add content without changing the original.

### 4. Wrap

Decorate an existing block with a wrapper component.

```js
registerBlock('books-detail-content', {
  component: AvailabilityWrapper,
  weight: 80,
  id: 'loans-availability-wrapper',
  operation: 'wrap',
  wraps: 'books-detail'
})
```

The wrapper receives the original block as a slot:

```vue
<!-- AvailabilityWrapper.vue -->
<template>
  <div class="availability-wrapper">
    <AvailabilityBadge />
    <slot />  <!-- original block renders here -->
    <LoanHistory />
  </div>
</template>
```

Use for cross-cutting concerns (borders, badges, analytics).

## Cross-Module Extension

The power of zones: modules extend each other without coupling.

### Module Init Pattern

Zones are registered in module `init.js` files, which receive `zones` from the kernel:

```js
// modules/books/init.js - Define zones
import { defineAsyncComponent } from 'vue'

const BooksListHeader = defineAsyncComponent(() => import('./components/BooksListHeader.vue'))

export function init({ registry, zones }) {
  // Define zones owned by this module
  zones.defineZone('books-list-header')

  // Register default block
  zones.registerBlock('books-list-header', {
    id: 'books-header',
    component: BooksListHeader,
    weight: 50
  })

  // Routes...
  registry.addRoutes('books', [...])
}
```

```js
// modules/loans/init.js - Extend Books zones
import { defineAsyncComponent } from 'vue'

const LoanAwareBooksHeader = defineAsyncComponent(() => import('./components/LoanAwareBooksHeader.vue'))
const LoanStatusColumn = defineAsyncComponent(() => import('./components/LoanStatusColumn.vue'))

export function init({ registry, zones }) {
  // REPLACE: Substitute Books header with loan-aware version
  zones.registerBlock('books-list-header', {
    id: 'loans-header-replacement',
    component: LoanAwareBooksHeader,
    weight: 60,
    operation: 'replace',
    replaces: 'books-header'
  })

  // EXTEND: Add overdue warning after header
  zones.registerBlock('books-list-header', {
    id: 'loans-status-extension',
    component: LoanStatusColumn,
    weight: 70,
    operation: 'extend',
    after: 'loans-header-replacement'
  })

  // Routes...
  registry.addRoutes('loans', [...])
}
```

### Module Order

Modules are initialized in discovery order (glob pattern). Define zones before extending them.

```js
// main.js - Kernel auto-discovers modules
const kernel = new Kernel({
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  // ...
})
```

## Duplicate Detection

Registering the same block ID twice triggers a warning in debug mode:

```
[qdadm:zones] Duplicate block ID "books-header" in zone "books-list-header".
This may indicate a module is being initialized multiple times.
```

This helps catch configuration errors. The duplicate still replaces the original for backward compatibility.

## API Reference

### useZoneRegistry()

```js
const {
  registerBlock,
  defineZone,
  getBlocks,
  hasZone,
  listZones,
  removeBlock,
  clearZone
} = useZoneRegistry()
```

### registerBlock(zoneName, config)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `component` | Component | required | Vue component to render |
| `weight` | number | `50` | Sort order (lower = first) |
| `id` | string | null | Unique identifier (required for replace/extend/wrap) |
| `props` | object | `{}` | Props passed to component |
| `operation` | string | `'add'` | `add` \| `replace` \| `extend` \| `wrap` |
| `replaces` | string | - | Target block ID (for `replace`) |
| `before` | string | - | Target block ID (for `extend`) |
| `after` | string | - | Target block ID (for `extend`) |
| `wraps` | string | - | Target block ID (for `wrap`) |

### Zone Component

```vue
<Zone
  name="zone-name"
  :props="{ shared: 'props' }"
  :context="{ extra: 'data' }"
/>
```

## Best Practices

1. **Register in module init**: Use `init({ zones })` not Vue lifecycle hooks
2. **Use descriptive zone names**: `books-list-header` not `header1`
3. **Always set `id`** for blocks that may be targeted by other modules
4. **Use weight ranges**: 0-30 (early), 40-60 (normal), 70-100 (late)
5. **Module naming**: Core modules first, extensions after (glob order)
