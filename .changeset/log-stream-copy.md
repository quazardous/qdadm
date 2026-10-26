---
'@quazardous/qdadm': minor
---

LogStream: a Copy button puts the whole log on the clipboard (#4344). It copies every line received at the click, as plain text, whatever the search filter or the scroll shows, and says "Copied (N lines)", or why the copy failed. On a page without the clipboard API (plain http) it falls back to the browser's copy command. `copy()` is exposed too. The task dialog's log now downloads as `<kind>-<task id>.log`.
