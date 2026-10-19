# PayloadViewer and PayloadDiff: messages in their own format

What an integration sends its providers is rarely JSON: XML to suppliers
and SOAP marketplaces, CSV feeds, form-encoded payment calls, plain text,
files. `PayloadViewer` shows a captured message in its own format.
`PayloadDiff` compares two of them, an expected message against a captured
one, or two captures of the same flow.

```vue
<PayloadViewer
  :body="capture.body"
  :content-type="capture.content_type"
  :request="{ method: capture.method, url: capture.url, status: capture.status, headers: capture.headers }"
  :mask="maskKeys()"
/>

<PayloadDiff :left="expected" :right="capture.body" :labels="['Expected', 'Captured']" :mask="maskKeys()" />
```

## Formats

The format comes from `format` if given, else from `content-type` (the
prop, or the request's `Content-Type` header), else from what the body looks
like.

| Format | Shown as |
|---|---|
| `json` | `JsonViewer` (a string is parsed; an object is taken as is) |
| `xml` | indented one element per line, with tags, attributes, values, comments and CDATA highlighted. An element holding only text stays on one line. |
| `csv` | a table. The separator (`,` `;` tab `\|`) is detected, and quoted fields, doubled quotes and fields over several lines are read. A toggle sets whether the first row is a header. 200 rows are shown, then "show all". |
| `form` | a key/value table, decoded |
| `text` | line numbers |
| `binary` | the size, the first 256 bytes in hex with their ASCII, and the download (a `Uint8Array` or `ArrayBuffer` body) |

XML is tokenized by hand and displayed as text, never handed to the DOM, so
nothing in a captured message can run or load. A body that does not parse
as the format it claims is shown as text, with a warning saying why (for
example `</a> does not close <b>`).

## The request

With `request: { method, url, status, headers }`, a block above the body
shows the method, the URL and the status (coloured by class), with the
headers folded underneath.

## Masking

`mask(key, value)` returns the text to show, or `undefined` to keep the
value. It runs before display, copy and download, on:

- JSON keys, at any depth;
- XML element text (the key is the element name) and attributes;
- CSV columns (the key is the header);
- form fields;
- headers.

`maskKeys(keys?, replacement?)` builds one from a list of names, compared
without case. With no list it masks the usual ones: `password`, `token`,
`secret`, `authorization`, `cookie`, `api_key`, `card_number`, `cvv`…

## Copy and download

Copy puts the text as shown on the clipboard (pretty-printed, masked).
Download saves it with the format's extension, or the original bytes for a
binary body. `filename` overrides the name.

## PayloadDiff

Both sides are normalized first, then compared line by line with a Myers
diff:

- JSON is pretty-printed with keys sorted at every depth;
- XML is indented;
- form fields are sorted;
- text is compared as is.

Key order and indentation disappear, so what remains is a difference of
content. Two payloads that differ only in formatting read "Identical".

- `mode`: `split` (side by side; a run of deleted lines faces the inserted
  lines that replace it) or `inline`. A toolbar button switches between them.
- `context` (3 by default): the unchanged lines kept around a change. Longer
  runs fold into "N unchanged lines", which opens on click.
- `csv-key`: for CSV, match rows on that column instead of comparing lines.
  Cells are compared by header name, so a reordered column is not a change.
  Rows show as added, removed or changed, with the changed cells showing old
  and new. Unchanged rows are hidden behind a toggle.
- `labels`: the two column titles, "Expected" and "Captured" by default.

The diff compares text. It does not detect a moved XML node or reordered
array items: those show as a deletion and an insertion.

The demo has a page for both: Features → Payloads.
