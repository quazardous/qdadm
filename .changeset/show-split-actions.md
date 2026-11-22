---
'@quazardous/qdadm': minor
---

Item page actions (#5444): `items` makes an action a split button, its own button with a chevron zone joined on its right that opens a menu of related gestures. The menu lines up with the button (its right edge when the button sits on the right of the window), opens upwards when there is no room below, and is appended to the body. Entries take `label`, `icon` and `tooltip` as functions of the record, plus `visible`/`disabled` from the action's context and `severity`. Hidden entries are left out, and with none left the action is a plain button. Without `onClick`, the button only opens the menu. The chevron has `aria-haspopup`/`aria-expanded` and a label ("More actions: Copy"), and Escape gives the focus back to it. `QdActionButton` is exported.
