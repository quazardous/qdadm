# EmailPreview: a captured email, shown safely

`EmailPreview` shows an email next to what it belongs to: the order
confirmation on its order, the supplier email on its purchase order. Typical
sources are mails caught by a Mailpit-like sink or saved as `.eml`. It shows
the HTML part, the text part, the source, the headers and the attachments.

```vue
<!-- A parsed email -->
<EmailPreview :email="{ from, to, cc, subject, date, headers, html, text, attachments }" />

<!-- A Mailpit message (GET /api/v1/message/{ID}) -->
<EmailPreview :email="fromMailpit(message, 'http://localhost:8025')" />

<!-- A raw MIME message -->
<script setup>
import { parseMime } from '@quazardous/qdadm/email'
</script>
<EmailPreview :raw="capture.source" :parser="parseMime" />
```

## The email

`email` takes a `ParsedEmail`. Every field is optional:

| Field | |
|---|---|
| `from`, `to`, `cc`, `replyTo` | `'a@b.c'`, `{ name, address }`, or a list of them |
| `subject`, `date`, `messageId` | |
| `headers` | `[{ key, value }]` in order, or `{ name: value \| value[] }` |
| `html`, `text` | the two parts |
| `raw` | the MIME source, for the Source tab |
| `attachments` | `[{ filename, contentType, size?, url? \| content?, contentId?, disposition? }]` |

`content` is base64 text or bytes. `contentId` is what the HTML references
as `cid:`.

`fromMailpit(message, baseUrl)` turns a Mailpit message into this shape,
pointing attachments and inline parts at
`{baseUrl}/api/v1/message/{ID}/part/{PartID}`.

## Raw MIME

A raw message (`raw`, as a string or bytes) needs a `parser`. `parseMime`
from `@quazardous/qdadm/email` parses multipart, charsets,
quoted-printable, base64 and encoded words through
[postal-mime](https://www.npmjs.com/package/postal-mime). postal-mime is
an **optional peer dependency**: install it (`npm install postal-mime`) to
use that entry point. Apps that only pass parsed emails need neither. Without
a parser, the component shows the source and says what is missing.

## How the HTML is kept from doing harm

An email is HTML written by whoever sent it, so the component never puts it
in the page:

- It renders in an `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">`.
  There are no scripts, no forms, and the frame has an opaque origin, so it
  cannot reach the page, its cookies or its storage.
- A Content-Security-Policy is placed first in the frame's head:
  `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'`.
  Nothing remote loads: no stylesheets, no fonts, no frames, and no images,
  since a remote image tells the sender that the email was opened.
- **Load images** adds `https:` and `http:` to `img-src`, for this email
  only. The toolbar says how many remote images were blocked.
  `load-images` starts with them allowed.
- `cid:` references are pointed at their attachments, as a data URL or the
  attachment's URL (whose origin is then allowed for images).
- Before rendering, the HTML is read with `DOMParser` (an inert document:
  nothing runs, nothing loads). Three things are removed there, with their
  attributes decoded as the browser would decode them:
  - `<meta http-equiv>`: a refresh would navigate the frame to a remote page;
  - `<base>`;
  - `<link>` hints such as `dns-prefetch`, `preconnect` and `prefetch`.
- Links open in a new tab. The frame sends no referrer.

The text part and the source are shown as plain text.

## What it shows

- The subject. Then from, to, cc, reply-to and the date, with every header
  under a fold.
- Tabs: HTML, Text and Source. Only the parts the email has are shown.
- The HTML view's height is set by `height` (`32rem` by default); the user
  can resize it.
- Attachments with their type, size, an "inline" mark, a download button,
  and a thumbnail for images (SVG excepted).

The demo has a page for it: Features → Emails. It includes a hostile email
whose script, refresh, prefetch, form, pixel and frame are all stopped.
