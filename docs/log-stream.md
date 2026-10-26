# LogStream: a live task log

`LogStream` shows a backend log as it is written (a box being created, a
database being refreshed), then the whole log once the task is done. It has
the controls an ops screen needs: follow the end, pause, search, jump to
errors, wrap, copy, download. It fits in a `ShowPage` and in a dialog.

```vue
<LogStream
  :source="{ poll: (from) => api.get(`/tasks/${id}/log`, { params: { from } }).then((r) => r.data) }"
  error-pattern="ERROR|FATAL"
  timestamp-pattern="\d{4}-\d\d-\d\dT[\d:]+Z"
  height="60vh"
  :filename="`task-${id}.log`"
/>
```

## Sources

The app picks how the lines arrive:

| Source | Shape | Ends when |
|---|---|---|
| `{ poll, intervalMs?, from? }` | `poll(from) → { lines, next?, done? }`, the `?from=<n>` contract. `next` defaults to `from + lines.length`. | `done: true` |
| `{ sse, event?, endEvent?, parse? }` | a URL or `() => EventSource`. Each `message` holds one line, several separated by newlines, or JSON `{ lines, done }`. | the `end` event |
| `{ subscribe }` | `subscribe({ push, end, fail }) → unsubscribe`, for an SSEBridge event, a WebSocket, anything that pushes. | `end()` |
| `{ lines }` | a finished log | at once |

Polling waits `intervalMs` (1 s by default) between calls. After an error it
doubles the wait, up to 30 s, and shows the error, until a call succeeds.
Reading stops when the component unmounts.

To share one log between two views (a task dialog and its page), build it
once with `useLogStream(source, options)` and pass it as `:stream`.

## What the viewer does

- **Follow**: on by default. Scrolling up pauses it, and a button counts the
  lines that arrived since. Scrolling back to the end, pressing End or
  clicking the button resumes it.
- **ANSI colours**: the 16 colours, 256 colours and truecolor, plus bold,
  dim, italic, underline and inverse. A style carries from one line to the
  next, as in a terminal. Other escapes (cursor moves, titles) are dropped.
  Text is always rendered escaped, never as HTML.
- **Search**: highlights matches. Enter and Shift+Enter go to the next and
  previous match; the filter button keeps only the matching lines. The
  search ignores case and the escapes.
- **Errors**: lines matching `error-pattern` are tinted and counted, and the
  toolbar button goes from one to the next.
- **Timestamps**: a `timestamp-pattern` at the start of a line is dimmed.
- **Copy**: every line received at the click goes to the clipboard as plain
  text, one per line, without escapes or line numbers, whatever the search
  filter or the scroll shows. The toolbar says "Copied (N lines)", or why the
  copy failed. Without the clipboard API (a page served over plain http), it
  uses the browser's copy command instead. The component exposes `copy()`,
  which resolves to the number of lines copied (0 on failure).
- **Download**: the whole buffer as text, without escapes. With
  `download-raw`, the escapes are kept.
- **Long logs**: without wrapping, only the rows on screen are rendered, so
  tens of thousands of lines scroll freely. With wrapping, rows have no fixed
  height, so they are all in the page and the browser skips drawing the ones
  off screen. Past `max-lines` (100 000 by default), the oldest lines are
  dropped and the line numbers keep counting.

## Props

| Prop | Default | |
|---|---|---|
| `source` | — | one of the sources above |
| `stream` | — | a `useLogStream()` the page already holds, used instead of `source` |
| `error-pattern` | — | regex or string (case-insensitive) |
| `timestamp-pattern` | — | regex or string, anchored at the start of the line |
| `height` | `24rem` | |
| `line-height` | `20` | row height in px without wrapping; change it together with the CSS |
| `wrap` | `false` | initial state of the wrap toggle |
| `follow` | `true` | initial state of follow |
| `line-numbers` | `true` | |
| `filename` | `log.txt` | download name |
| `download-raw` | `false` | keep the ANSI escapes in the download |
| `max-lines` | `100000` | |

It emits `done` when the source reports the end of the log, e.g. to re-read
the task record at once (the TaskRunner dialog does, and names the download
`<kind>-<task id>.log`).

The panel stays dark in both themes. Its colours are CSS variables on
`.qd-log-stream` (`--qd-log-bg`, `--qd-log-fg`, `--qd-log-muted`,
`--qd-log-mark`, `--qd-log-error-bg`).

The demo has a page for it: Features → Log stream.
