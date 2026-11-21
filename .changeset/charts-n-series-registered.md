---
'@quazardous/qdadm': minor
---

Charts (#5441): the `viz` block stacks areas as well as bars (`stacked: true`; `chart: 'stacked'` stays stacked bars), its range over the pile. `registerChart(name, Component)` lets the app draw any `chart: '<name>'` with its own component (series read, colours as CSS values, height, thresholds, the domain bar's mode); a name nobody registered draws a line, with a dev warning. The `metric` card takes `options: { chart, stacked }` (a line by default, so a high, flat series no longer fills its pill as a block) and N series in `data.series` (`{ label, points, tone }`); its domain bar pill builds the same chart, its tooltip giving each named series' last value, and a larger card with several series draws the full chart with its legend. The `trend` card takes `options.chart`.
