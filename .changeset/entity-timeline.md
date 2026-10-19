---
"@quazardous/qdadm": minor
---

feat(display): `EntityTimeline`, one entity's history across several actors (#4111). It takes the events as an array, or reads an events entity through its manager and rereads it on a remote change, flashing what is new. Events are ordered by time, with day separators and relative times. Each actor gets a colour and an icon, and actors can be hidden, with the filter kept in the URL through `query-key`. Events expand into a `#detail` slot, and `gaps` shows the time since the previous event or named durations such as "order → ready to ship: 17 h". `map` adapts an app's own event shape.
