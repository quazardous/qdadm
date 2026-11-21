---
'@quazardous/qdadm': minor
---

Dynamic domain indicators (#5438): `title`, `icon` and `to` take a value or a function of the indicator's data, read again at each read (pill, mini card, tooltip, screen-reader text, the nav badge, an app component's props); `visible(data)` leaves a slot out, full or compact, once its data is read. The card reads only the fields its schema declares, so the data may carry more for these functions (a "top N" slot's label and link). The demo's library bar has a "Top: <genre>" indicator and a slot left out while empty.
