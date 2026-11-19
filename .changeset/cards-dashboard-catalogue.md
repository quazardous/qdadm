---
'@quazardous/qdadm': minor
---

`CardsDashboard` gets a catalogue, cards with parameters, the size each person picks and named sections (#5348, lot 3 of #5337). A block declared `card: { repeatable: true, params }` is added from "Add a card" as many times as wanted, each instance with its parameters (a form drawn from the JSON Schema, checked before the card is added) merged into the block's props; a classic `Zone` does not show it. The catalogue also lists the hidden cards. Each card's bar has its size (`s`, `m`, `l`, among `card.sizes`) and, with sections, its section; "Add a section" groups the cards under names, edited in place. The arrangement is now `v: 2` (`sizes`, `sections`, `sectionOf`, `instances`); a v1 one migrates as it is, and an instance whose block is gone or whose parameters no longer fit is dropped.
