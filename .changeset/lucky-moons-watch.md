---
'@quazardous/qddebug': minor
---

The debug bar suspends itself on a render loop, and no longer measures its own content

**Circuit breaker.** Past 60 updates in one second the bar freezes and replaces
itself with a plain notice saying why. A render loop throws nothing, so qdadm's
error boundary cannot see it — the app simply stops responding. A consumer
lived through exactly that, and their only exit was to rebuild without the bar.
The window logic is a plain object holding no reactive state, so the counting
can never itself schedule a render.

**Never measure your own content.** The `ResizeObserver` used to watch the bar
header — the very element whose contents it drives, since the measured width
decides how the header's tabs render. It now watches the panel, whose width
comes from the display mode and never from the tabs inside it, so the reading
cannot feed itself. This was *not* the cause of the loop reported earlier —
that deduction was wrong and the consumer's measurement disproved it — and it
is fixed here as hygiene.

The compact-tab thresholds now see the panel's width rather than the header's,
wider by the header's padding; they are heuristics at 400 and 600 pixels.
