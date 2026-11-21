---
'@quazardous/qdadm': minor
---

Domain bar indicators know the bar's mode (#5422): each pill says `data-mode` (`full` or `compact`), a card's pill form receives the mode (`pill(data, options, locale, mode)`) and may return `blocks` drawn after the badge; `metric` draws its `series` as a sparkline in the full bar only (option `spark`, size from `--qd-domain-pill-viz-width` / `-height`). An indicator may give its own `component` (props `{ data, options, status, mode, title, icon, state, value, count }`, `card` then optional) and `compact: { options, component }` overrides for the compact bar.
