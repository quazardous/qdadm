---
"@quazardous/qdadm": minor
---

feat(display): `EmailPreview`, a captured email shown safely (#4113). The HTML part renders in a sandboxed iframe: no scripts, no forms, an opaque origin. A Content-Security-Policy lets nothing remote load, and remote images wait for a "Load images" toggle. Meta refreshes, `<base>` and prefetch hints are removed through an inert `DOMParser` pass, and `cid:` images point at their attachments. The component also shows the text part and the source, the main headers with every header under a fold, and the attachments with sizes, thumbnails and downloads. It takes a parsed email, a Mailpit message through `fromMailpit()`, or raw MIME through `parseMime` from the new `@quazardous/qdadm/email` entry, which needs `postal-mime`, a new optional peer dependency (>= 3).
