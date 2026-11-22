---
'@quazardous/qdadm': minor
---

The run bar is a slim line at the content's foot, drawn like the domain bar's toolbox: AppLayout hosts it (sticky at the bottom, flush, the side menu's height, no card), the pages draw theirs only without AppLayout (`RUN_BAR_HOST`, `placement="foot"` for a custom layout); "Back to the list" (L) ends the run and returns where it started, hidden when there is nowhere to go back; the details and a 3px strip on the same line; on a phone, icons only (#5453)
