# Branding: name, logo, page icon, top banner

The `app` options of `createQdadm` (or the Kernel's `app`) carry the app's identity.

```js
app: {
  name: 'My Admin',
  logo: '/logo.svg',
  favicon: '/icon.svg', // optional, see below
}
```

## Page icon: `app.favicon`

| `app.favicon` | Page icon |
|---|---|
| a URL | set on the page's `link[rel~=icon]`, or added when there is none |
| not set | the page's own icon stays (declared in `index.html`, or set in JS before the mount); the qdadm logo only when the page has none |
| `false` / `null` | qdadm never touches the head |

An app that declares its icon in `index.html` needs nothing more.

## Top banner: `app.banner`

A strip across the top of every page, the login page included: which environment this is, a maintenance notice. The layout starts below it, nothing is covered.

```js
app: {
  banner: { id: 'env', text: 'PRODUCTION — real deliveries', severity: 'error' },
}
```

`app.banner` takes one message, a list, or a function returning either. A function is read reactively, so it can follow app state:

```js
app: {
  banner: () => (target.value === 'prod' ? { id: 'env', text: 'PROD', severity: 'error' } : null),
}
```

| Field | |
|---|---|
| `text` | the message |
| `severity` | `info` (default), `success`, `warn`, `error`: the strip's colour |
| `icon` | a PrimeIcons class, or `false`; default: one per severity |
| `link` | `{ label, href }` after the text; an absolute URL opens in a new tab |
| `closable` | show a × (default `false`: the message stays) |
| `priority` | higher first (default 0) |
| `id` | a stable id: a message shown again under it replaces it, and closing it lasts the browser session |

At runtime, `useAppBanner()` adds and removes messages:

```js
import { useAppBanner } from '@quazardous/qdadm'

const banner = useAppBanner()
banner.show({ id: 'maintenance', text: 'Maintenance at 22:00', severity: 'warn', closable: true })
banner.hide('maintenance')
```

With several messages, the strip shows one at a time with ‹ n/N › to page through them. It shows the first one until the user pages. Closing a message shows the next one; when none are left, the strip goes. A closed message with an `id` stays closed for the browser session, even if the app shows it again: to bring it back, use a new id.

AppLayout, BaseLayout and LoginPage render the strip. A page outside them places `<AppBanner />` itself. The strip's height is in `--qd-banner-height` on `<html>` (0 without a strip): the layouts and the top toasts read it, and so can an app's own fixed elements. The layouts' `#banner` slot replaces the text, with the message as `message`:

```vue
<AppLayout>
  <template #banner="{ message }"><strong>{{ message.text }}</strong></template>
</AppLayout>
```
