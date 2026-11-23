---
'@quazardous/qdadm': minor
---

A list filter's choices: `list.setFilterOptions(name, options)` sets them from the app at any time (with "All", no loader overwrites them); `optionsFromCache` builds them on an empty list and with a value already set (the processor's and that value's, kept only once complete), where the dropdown stayed empty; the value filtered on is always among the shown choices, as its raw value when they lack it (#5457)
