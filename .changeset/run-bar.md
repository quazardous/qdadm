---
'@quazardous/qdadm': minor
---

A run walks a set of items one after the other from their edit or show page (#5343). `QdRunBar`, drawn by `FormPage` and `ShowPage` when the URL carries `?run=`, says "Book 3 of 14 to process" with the filter and the order, has Previous / Next (and K / J), and a strip of done, urgent and current items. In a run, a form's Save & Close becomes "Save and go to the next"; at the end, the run says so and goes back where it started. Runs start from a filtered list on their own (opening a row walks the list's rows), from `list.startRun()`, from a card's `action.run`, or from `useRun().start()`. Leaving a changed form for another record of the same page now asks first, as leaving the page does.
