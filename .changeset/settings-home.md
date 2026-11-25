---
"@quazardous/qdadm": minor
---

The settings home (#5500): `settingsMenu.home: true` mounts qdadm's own settings page (`QdSettingsHome`, the settings menu's entries as cards by section, as the menu shows them) as `settings-home` on `/settings` (`/settings-home` when the app has a `/settings`); `home: 'route-name'` names the app's own. The settings menu's first row leads to it and it opens the settings menu. Every settings page's breadcrumb starts from it: « Home › Settings › Section › Page », set by `settingsMenu.breadcrumb` (`'section'` default, `'home'`, `false`); a route's own `meta.breadcrumb` keeps it. `useNavigation()` gives `settingsSection`.
