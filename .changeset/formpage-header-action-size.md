---
"@quazardous/qdadm": patch
---

Fix asymmetric button size between `FormPage` and `ListPage` header actions. `ListPage.vue` forced `size='small'` on its header action buttons, but `FormPage.vue` rendered actions from `form.addAction(...)` without a `size` prop — so PrimeVue's default (normal/large) showed up on edit pages, breaking visual coherence with the list. Reported by skybot-claude in qdadm #1016.

`FormPage.vue` now renders header actions with `:size="action.size || 'small'"` to match `ListPage`. Symmetric overrides: `size?: string` is now part of the shared `ActionConfig` (`useEntityItemFormPage.types.ts`) and `HeaderActionConfig` (`useListPage.types.ts`) — consumers can opt into a different size from either side without touching component code. `ListPage.vue`'s local widening `interface ResolvedHeaderAction extends BaseResolvedHeaderAction { size?: string }` is removed since the base type now carries `size` directly.

Default remains `'small'` on both pages, so no breaking change for existing consumers.
