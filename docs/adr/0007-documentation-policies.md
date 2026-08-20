# 0007 — Current-state-only docs, lean README

**Status:** Accepted (backfilled 2026-08-20)

## Context

Documentation for a fast-moving solo-maintained framework decays in two
predictable ways. It accumulates version-gated advice — "since 1.18…", "on
older versions…", "note that before 1.19.2 this was broken" — until a reader
cannot tell what is true today. And the README becomes the path of least
resistance for every new feature note, growing into an unnavigable manual that
duplicates, and then contradicts, the topic docs.

Both are worse here than in a typical project: qdadm's docs are read as much by
AI agents as by humans, and an agent cannot weigh a hedge — it reads a
version-gated caveat as a current constraint and codes around a problem that no
longer exists.

## Decision

Two policies, applied to everything under `docs/` and to the README:

1. **Current state only.** Docs describe how the code works *now*. No
   version-gated caveats, no historical notes, no dated gotchas, no "this used
   to…". History lives in the CHANGELOG, which is generated from changesets and
   is the only place that carries it. The one exception is [`adr/`](README.md),
   whose entire purpose is to record dated decisions.
2. **Lean README.** The root README is an entry point, not a manual: one line
   and one link per topic, substance in a dedicated `docs/` file. The same rule
   governs `AGENTS.md`, which routes rather than explains.

## Consequences

- A reader — human or agent — can trust any doc page as describing the current
  release without cross-checking the version.
- Removing an obsolete caveat is always correct and needs no deliberation. When
  behaviour changes, the doc is rewritten rather than annotated.
- Someone who needs "when did this change?" has to read the CHANGELOG. That is
  the intended split, and it keeps the burden on the rarer question.
- New material must find its home: adding to the README is refused by default,
  which means either an existing topic doc grows or a new one is created.
- Docs describing behaviour that no longer exists are a defect, not merely
  stale. The tutorial and README patterns are pinned by the consumer-smoke
  fixture ([ADR 0006](0006-consumer-smoke-as-stability-contract.md)) so that at
  least the documented *types* cannot silently rot.
