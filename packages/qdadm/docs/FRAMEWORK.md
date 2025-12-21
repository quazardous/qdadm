# Dashboard Framework Guide

Quick reference for components, patterns and CSS classes. For detailed CRUD architecture and composable usage, see [`DASHBOARD.md`](./DASHBOARD.md).

## Components (`common/components/`)

### Layout
| Component | Usage |
|-----------|-------|
| `AppLayout` | Main app shell with sidebar |
| `PageLayout` | Standard page wrapper |
| `PageHeader` | Title + breadcrumb + actions slot |
| `ListPage` | Data table with filters, pagination, actions |

### Forms
| Component | Usage |
|-----------|-------|
| `FormField` | Label + input wrapper with validation |
| `FormActions` | Save/Cancel/SaveAndClose buttons |
| `FormTabs` / `FormTab` | Tab navigation for forms |
| `UnsavedChangesDialog` | Confirm navigation with dirty form |

### Data Display
| Component | Usage |
|-----------|-------|
| `CardsGrid` | Stats cards row |
| `RichCardsGrid` | Cards with icons and details |
| `CopyableId` | ID with copy button |
| `IntensityBar` | Visual score bar |
| `JsonViewer` | Read-only JSON display |
| `EmptyState` | No data placeholder |

### Editors
| Component | Usage |
|-----------|-------|
| `VanillaJsonEditor` | Full JSON editor (tree/text/table) |
| `JsonEditorFoldable` | Collapsible JSON sections |
| `JsonStructuredField` | Toggle structured/JSON mode |
| `KeyValueEditor` | `Array<{key, value}>` editor |
| `LanguageEditor` | Languages with fluency |
| `ScopeEditor` | Permission scopes |

### Dialogs
| Component | Usage |
|-----------|-------|
| `SimpleDialog` | Standard modal with confirm/cancel |
| `BulkStatusDialog` | Bulk status change |
| `CreateStoryDialog` | Story creation flow |
| `GenerateImageDialog` | Image generation params |

### Table Helpers
| Component | Usage |
|-----------|-------|
| `ActionColumn` | Row action buttons |
| `ActionButtons` | Header action buttons |
| `FilterBar` | Search + filters row |

---

## Composables (`common/composables/`)

| Composable | Purpose |
|------------|---------|
| `useListPageBuilder` | Complete CRUD list (filters, pagination, actions) |
| `useForm` | Form state, validation, save/cancel |
| `useBareForm` | Minimal form without routing |
| `useSubEditor` | Sub-component for complex form sections |
| `usePageBuilder` | Generic page builder |
| `useDirtyState` | Track unsaved changes |
| `useUnsavedChangesGuard` | Block navigation if dirty |
| `useTabSync` | Sync tabs with URL query |
| `useBreadcrumb` | Breadcrumb builder |
| `useEntityTitle` | Dynamic page title |
| `useQueueStatus` | Queue status options |
| `useJsonSyntax` | JSON validation helpers |
| `useNavigation` | Reactive navigation state from router.js |

---

## CSS Classes (`styles/main.css`)

### Layout
```css
.app-layout          /* Main grid layout */
.sidebar             /* Left navigation */
.main-content        /* Right content area */
.page-content        /* Inner page padding */
```

### Page Structure
```css
.page-header         /* Title row container */
.page-title          /* H1 with flex for back button */
.header-actions      /* Right-aligned action buttons */
```

### Forms
```css
.form-grid           /* Vertical form container */
.form-field          /* Label + input + hint wrapper */
.form-row            /* 2-column grid */
.form-row-3          /* 3-column grid */
.form-row.metadata   /* 4-column metadata row */
.toggle-field        /* Horizontal label + toggle */
.field-hint          /* Small help text */
```

### Info Display (read-only)
```css
.info-grid           /* Grid for key-value pairs */
.info-item           /* Single key-value container */
.info-label          /* Small uppercase label */
.info-value          /* Value text */
.info-row            /* Horizontal key-value pair */
.info-block          /* Bordered info section */
```

### Cards
```css
.stats-grid          /* Stats cards container */
.stat-card           /* Individual stat card */
.stat-card-value     /* Big number */
.stat-card-title     /* Card label */
```

### States
```css
.loading-state       /* Centered spinner container */
.loading-state--inline  /* Compact inline loading */
.empty-state         /* No data message */
.error-message       /* Error box with border */
.timestamps-grid     /* Grid for date/time values */
.timestamps-grid--separator  /* With top border */
.timestamp           /* Label + value pair */
```

### Sections
```css
.section-header      /* Icon + title row */
.section-title       /* Section heading */
.section-title--separator  /* With top border */
.section-description /* Muted intro text */
```

### Config Pages
```css
.config-intro        /* Icon + explanation box */
.config-field        /* Config field spacing */
```

### Images
```css
.image-gallery       /* Grid of images */
.image-card          /* Image container */
.image-card--clickable  /* Hover effects */
.image-caption       /* Image label */
```

### Utilities
```css
.text-muted          /* Secondary text color */
.w-full              /* width: 100% */
.flex, .flex-col     /* Flexbox */
.items-center        /* align-items: center */
.justify-between     /* space-between */
.gap-1, .gap-2       /* Gap spacing */
.mt-1, .mb-2, .p-2   /* Spacing */
```

---

## Routing

### Route Names Only - No Direct URLs

**Direct URL usage is forbidden.** Always use route names.

```javascript
// BAD - hardcoded paths
router.push('/agents/123/edit')
<RouterLink to="/agents">Agents</RouterLink>

// GOOD - route names
router.push({ name: 'agent-edit', params: { id: 123 } })
<RouterLink :to="{ name: 'agents' }">Agents</RouterLink>

// GOOD - use helper functions
import { path, route, navigateTo } from '@/router'

const url = path('agent-edit', { id: 123 })  // → '/dashboard/agents/123/edit'
navigateTo('agent-edit', { id: 123 })         // programmatic navigation
<RouterLink :to="route('agents')">Agents</RouterLink>
```

### router.js Exports

| Export | Usage |
|--------|-------|
| `default` | Vue Router instance |
| `navSections` | Navigation menu structure (from module registry) |
| `path(name, params)` | Generate URL string (like Symfony's `path()`) |
| `route(name, params)` | Get route object for `:to` |
| `navigateTo(name, params)` | Programmatic navigation |
| `isRouteInFamily(current, parent)` | Check route hierarchy |

### Route Naming Convention

```
{entity}           → list page (agents, events, stories)
{entity}-create    → create form
{entity}-edit      → edit form
{entity}-show      → detail/view page
```

---

## Module Registry (`common/moduleRegistry.js`)

Routes and navigation are **not centralized**. Each module registers its own routes via an `init.js` file.

### How It Works

1. `router.js` calls `initModules()` at startup
2. `moduleRegistry.js` auto-discovers all `modules/*/init.js` files
3. Each module's `init()` function registers routes, nav items, and route families
4. `router.js` collects all routes via `getRoutes()` and `getNavSections()`

### Module init.js Template

```javascript
// modules/agents/init.js
export function init(registry) {
  // Routes with path prefix (avoids repetition)
  registry.addRoutes('agents', [
    { path: '', name: 'agents', component: () => import('./pages/AgentList.vue') },
    { path: 'create', name: 'agent-create', component: () => import('./pages/AgentForm.vue') },
    { path: ':id/edit', name: 'agent-edit', component: () => import('./pages/AgentForm.vue') }
  ])

  // Navigation item (appears in sidebar)
  registry.addNavItem({
    section: 'Simulation',
    route: 'agents',
    icon: 'pi pi-user',
    label: 'Agents'
  })

  // Route family (for active nav state detection)
  registry.addRouteFamily('agents', ['agent-'])
}
```

### Registry API

| Method | Description |
|--------|-------------|
| `addRoutes(prefix, routes)` | Register routes with path prefix |
| `addNavItem({ section, route, icon, label, exact? })` | Add sidebar nav entry |
| `addRouteFamily(parent, prefixes)` | Define child route prefixes |

### Path Prefix

The prefix is applied automatically to route paths:

```javascript
registry.addRoutes('agents', [
  { path: '', ... },           // → 'agents'
  { path: 'create', ... },     // → 'agents/create'
  { path: ':id/edit', ... }    // → 'agents/:id/edit'
])
```

### Nav Sections

Sections are ordered by `sectionOrder` in moduleRegistry.js:
- Overview, Security, Simulation, Events, Collider, Settings

Modules assign themselves to sections via `addNavItem({ section: 'Simulation', ... })`.

### Route Families

Route families enable active nav state for child routes:

```javascript
registry.addRouteFamily('agents', ['agent-'])
// → 'agent-create', 'agent-edit' highlight 'Agents' nav item
```

### useNavigation Composable

For reactive access in components:

```javascript
import { useNavigation } from '@/common/composables/useNavigation'

const { navSections, isNavActive, sectionHasActiveItem } = useNavigation()
```

---

## Pattern Reference

### List Page (CRUD)
```javascript
const list = useListPageBuilder({
  endpoint: '/items',
  entityName: 'item',
  routePrefix: 'item'
})
list.setApiClient(apiClient)
list.addCreateAction()
list.addEditAction()
list.addDeleteAction()
```

### Form Page
```javascript
const { form, loading, saving, dirty, submit, cancel } = useForm({
  endpoint: '/items',
  routePrefix: 'items',
  entityName: 'Item',
  initialData: { name: '', active: false }
})
```

### Tab Sync
```javascript
const { activeTab, onTabChange } = useTabSync({
  validTabs: ['overview', 'settings', 'history'],
  defaultTab: 'overview'
})
```

### Sub-Editor Pattern

For complex forms, extract sections into sub-components that handle UI but not persistence.

**Parent form** (handles persistence):
```vue
<script setup>
const { form, submit } = useForm({ endpoint: '/configs', ... })
</script>

<template>
  <!-- Sub-editor receives v-model, parent handles save -->
  <ColliderEditor v-model="form.value" />
  <FormActions @save="submit" />
</template>
```

**Sub-editor** (handles UI only):
```vue
<script setup>
import { useSubEditor } from '@/common/composables/useSubEditor'

const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])

const { data, update, field } = useSubEditor(props, emit)

// Computed field with get/set (for v-model)
const threshold = field('threshold', 0.5)

// Or update directly
function setThreshold(value) {
  update('threshold', value)
}
</script>

<template>
  <Slider v-model="threshold" :min="0" :max="1" />
  <!-- or -->
  <Slider :modelValue="data.threshold" @update:modelValue="v => update('threshold', v)" />
</template>
```

**useSubEditor API:**
- `data` - Reactive reference to modelValue
- `update(path, value)` - Update field and emit (supports nested: `'config.nested.value'`)
- `field(path, default)` - Create computed ref for v-model binding
- `fields({ path: default, ... })` - Create multiple field refs
- `get(path, default)` - Get value with fallback
- `replace(newData)` - Replace entire data object

---

## Remaining Factorization Opportunities

### Potential New Shared Components

| Need | Candidate Files | Proposed Component |
|------|-----------------|-------------------|
| Inline loading | PipelinesConfigForm, TasksConfigForm | `InlineLoader` |
| Toggle with hint | DomainForm, multiple configs | `ToggleField` |
| Metric display | PromptJobShow metrics | `MetricsGrid` |

### Config Forms Pattern
Many config forms (`*ConfigForm.vue`) share:
- Same loading state pattern
- Same save/cancel flow
- Similar section structure

Consider: `useConfigLayout` composable for UI layout (without persistence).

---

## Quick Checklist

Before creating a new page:

1. **List page?** Use `useListPageBuilder` + `ListPage`
2. **Form page?** Use `useForm` + `FormField` + `FormActions`
3. **Need tabs?** Use `useTabSync` + `FormTabs`/`FormTab`
4. **Need dialog?** Use `SimpleDialog` with slots
5. **Check main.css** for existing utility classes
6. **No scoped CSS** for common patterns (use global classes)
