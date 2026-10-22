---
"@quazardous/qdadm": minor
---

Running tasks show in the notification zone when it is on: a status item per task (a click reopens its dialog) and the badge activity ring until it ends; TaskTray is then hidden, `tasks: { tray: true | false }` in the Kernel options forces it. Status items take an `onClick`. TaskTray uses the sidebar colours (it was a white box on the dark sidebar). The notification panel and badge strings come from the catalogue (`core.notifications.*`, English and French) (#4171).
