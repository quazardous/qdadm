---
"@quazardous/qdadm": minor
---

LoginPage reads its strings from the catalogue (`core.login.*`, English and French): field labels, submit button, the "or" divider and the welcome, failure and configuration toasts. Explicit `usernameLabel` / `passwordLabel` / `submitLabel` props still win. New `welcomeToast` prop (default `true`): `false` drops the "Welcome / Logged in as …" toast (#4168).
