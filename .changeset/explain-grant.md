---
"@quazardous/qdadm": minor
---

`explainGrant(checker, attribute, subject?)` says why a permission is granted or denied (#2363).

It takes `SecurityChecker.isGranted`'s own path and says what it found, without granting anything:

- the app's `security.grant` function, when it answers;
- the role hierarchy, for a `ROLE_*` attribute;
- the nearest role whose grant covers the key, its exact key before a wildcard;
- the user's own permissions;
- otherwise, the roles that were looked at.

It is exported from `@quazardous/qdadm/security`. In debug mode, `window.__qdadm.security.explain(key)` calls it with the kernel's checker.
