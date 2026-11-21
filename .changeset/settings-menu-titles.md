---
"@quazardous/qdadm": patch
---

The settings menu shows its section titles again even when it has only one section (#5418), so the open menu always shows which menu it is. Before this, a menu with a single section, and without the back row that is now off by default, had no title at all. `features.settingsMenu.flat: true` still hides every section title.
