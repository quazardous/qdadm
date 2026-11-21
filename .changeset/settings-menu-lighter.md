---
"@quazardous/qdadm": minor
---

The settings menu behind the gear is lighter and has its own colours (#5410). It no longer draws a back row at its head: the gear and Escape bring the main menu back, and `features.settingsMenu.back: true` restores the row, which now reads "← Menu". A section alone in the menu has no title, since the title would repeat the menu's name. When there are several sections, each keeps its title, and `settingsMenu.flat` forces titles off (`true`) or on (`false`). While open, the menu uses a deeper blue with light electric blue accents, and the gear takes the same accent. The colours come from themable `--qd-settings-menu-*` CSS custom properties, and `settingsMenu.tone: false` keeps the main menu's colours instead.
