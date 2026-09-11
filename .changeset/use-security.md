---
"@quazardous/qdadm": minor
---

`useSecurity()`: ask for a permission from a component (#2242).

`const { isGranted } = useSecurity()` returns the same verdict as the entity managers — the app's `security.grant` judge first, then the role matrix — for a permission or a `ROLE_*`, optionally about a subject.

- **No cache:** the remount on `security:changed`, login and logout is what makes a `v-if="isGranted('…')"` show new answers.
- **No security configured:** it grants, like the managers.

See docs/security.md, "In a component: `useSecurity()`".
