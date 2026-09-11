---
"@quazardous/qdadm-mcp": minor
---

Act in the page like a user, on the relay (#2247), on the refs `page_snapshot` and `find` print:

- `click` (right click, double click, modifiers), `type_text` (key by key: masks, number fields and autocompletes see every key), `press_key` ("Enter", "Shift+Tab", "Control+a", or a sequence), `hover`, `scroll`, `drag`, `upload_file`.
- `fill` sets any field whatever the control: a text field is typed into, a checkbox or switch clicked when its state differs, a select or a PrimeVue dropdown opened and its option clicked, an autocomplete's matching suggestion picked, a date input set whole. A missing option lists those there are.
- A click on a disabled element, or on one covered by a dialog or an overlay, is refused with the reason.
- The defaults a browser runs only for real input run too, unless the app prevents them: Enter submits or presses, Tab moves focus, Space toggles, Backspace deletes.
- Every action returns what it did, the dialog it opened or closed (with its ref), what has focus, the route, and the feedback block. After typing, it waits out the list's search debounce before answering.
- The debug bar floating over the app is looked through, never clicked.
- Nothing waits on animation frames or chained timers: the actions keep working in a background tab, where the browser suspends the first and slows the second.
- `page_eval` runs JavaScript in the tab and hands back a JSON-safe value; elements come back with a ref.
- `navigate` also takes `history`: back, forward or reload.
- `console_messages` returns the tab's console: failures since it connected, and log, info and debug from the first call on.
- `network_requests` returns the tab's fetch and XMLHttpRequest calls, with status and duration. A failed request also shows in the feedback block, as `failedRequests`.
- `readOnly` (`--read-only`) now leaves out every tool that acts in the page, the entity writes included. Reading, hovering and scrolling stay.
