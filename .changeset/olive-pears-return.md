---
'@quazardous/qdadm': minor
---

The list's current page now lives in the URL

It was the only piece of list state that survived nothing. Filters, search,
sort and rows-per-page were all remembered; the page was not. So list → detail
→ back dropped the user on page 1 — on a large corpus that is not an
inconvenience, it is losing your place — and a shared list link never showed
what the sender was looking at.

With `syncUrlParams` on (the default), the page is written to the URL once it
leaves 1 and removed when it returns, so a pristine list still leaves a clean
link. It is restored before the first request, not after, so there is no
wasted round trip. Changing or clearing a filter resets it, since the results
are renumbered.

`page` and `search` are the URL sync's own keys. A filter named either now
raises a one-off dev warning naming what happens instead: the list's own state
wins and the filter will not survive a reload. The `search` collision has
existed for as long as the URL sync has, silently — this is the first time it
says anything.

Two lists synchronising on one route will fight over `page`; an embedded list
should set `syncUrlParams: false`, as `page-compositions.md` already advised
for filters.
