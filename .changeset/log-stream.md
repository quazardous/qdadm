---
"@quazardous/qdadm": minor
---

feat(display): `LogStream`, a live tail of a backend log (#4110). It reads a task log as it is written, through offset polling (`poll(from) → { lines, next, done }`), server-sent events, a push `subscribe`, or a finished `lines` array, and keeps following the end until the user scrolls up. It renders ANSI colours (16, 256, truecolor), searches with a "only matching lines" filter, counts and jumps to error lines, dims timestamps, wraps on demand and downloads the log. Only the rows on screen are drawn, so a log of tens of thousands of lines stays smooth. `useLogStream()` holds the buffer for a page that shares one log between two views, and `parseAnsiLine` / `stripAnsi` are exported from the utils.
