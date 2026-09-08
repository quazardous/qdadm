---
'@quazardous/qdadm': patch
---

A search term that looks like a number survives the round trip

Found while a consumer was wiring their search box: their offers list is
searched by **reference number**, and that turns out to be the case the URL
round trip destroyed.

Three parts, each silently dropping the term further along:

**The persister coerced too eagerly.** `?level=42` coming back as the number
42 is right — a query string is meant to be read by people. `'007'` coming
back as 7 is not, and neither is a 19-digit id coming back as a float. The
coercion now happens **only when it round-trips exactly**: if the number
cannot be written back as the same text, the text was never a number. Order
ids, invoices, phone numbers and reference prefixes all live in that gap.

**`restoreFilters` required a string.** A term that *did* survive the numeric
round trip came back as a number and the guard dropped it, so the box
reopened empty and the list unfiltered — a shared link showed the recipient
something other than what the sender searched for.

**`searchItems` ignored anything but a string**, returning the whole list
untouched. So even a term that reached a storage as a number filtered nothing,
without a word. Numbers now search; objects and booleans are still ignored,
because there is no sensible text for them.

⚠️ **Behaviour change worth knowing:** a query parameter whose text cannot be
reproduced from its number now stays a **string** where it used to become a
lossy number. `?ref=007` gives `'007'`, not `7`. If you were relying on that
coercion, you were relying on losing information — but check any `===`
comparison against a number.
