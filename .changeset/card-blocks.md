---
"@quazardous/qdadm": minor
---

Cards are now built from blocks (#5414).

- **The blocks.** Six kinds:
  - `value`: the number, its change, or now against then;
  - `viz`: a small chart in the style of Munin;
  - `list`: hot lines, a queue, a feed or a ranking;
  - `text`;
  - `progress`: a goal's pace or a bullet graph;
  - `parts`: one split bar with its legend.
- **The `viz` block.** Light SVG with no library. It draws lines, areas, grouped bars or stacked bars, with one or several series over time. Warning and critical thresholds are drawn as dashed lines, and a band of normal can be shown with the points outside it marked. At size `s` it is a sparkline. At `m` and `l` it adds a time axis (24h, 7d or 30d), the y range, a legend and a tooltip for each column, opened by hovering or with the arrow keys. Screen readers hear a summary of each series.
- **Three ways to compose:**
  - the new `blocks` card type, `data: { blocks: [...] }`;
  - `envelope.blocks` (or a dashboard block's `card.blocks`), which draws blocks under any card's own body;
  - `registerCard({ type, meta, schema, blocks: (data, options, size) => [...] })`, a type declared by its blocks, with no component.
- **Validation.** Each block is checked against the schema of its kind, and a block that does not fit says which field is wrong.
- **The built-in types.** `metric`, `trend`, `queue`, `feed`, `goal`, `bullet`, `compare`, `ranking` and `split` are now rebuilt from the same blocks. Their data, options and CSS classes are unchanged.
