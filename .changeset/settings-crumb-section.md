---
"@quazardous/qdadm": patch
---

A settings page's breadcrumb (#5501): the section step links to the settings home, on that section (`#settings-<slug>`, the id each section of `QdSettingsHome` carries, scrolled to on arrival). It is left out when it repeats the home's name (case and accents aside) or when the settings menu has a single section.
