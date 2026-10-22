# Branding: name, logo, page icon

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
