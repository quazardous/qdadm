---
"@quazardous/qdadm": minor
---

A settings menu behind a gear at the foot of the side menu: entries with `menu: 'settings'` (`ctx.navItem`, `ctx.crud` nav) or whole sections named in `features.settingsMenu.sections` leave the main menu for it. It shows for whoever sees one of its entries and passes `features.settingsMenu.visible(user)`. A click slides the main menu away (a swap under reduced motion); the gear is a button with `aria-expanded`, the closed menu is inert, the focus follows; a settings page opens it by itself. `useSettingsMenu()` and `QdSidebarMenus` for layouts of an app's own.
