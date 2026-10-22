# Sidebar user box

When auth is on, the bottom of the sidebar shows the signed-in user: an avatar, their name, and their email (or role, if there is no email).

## Profile link: `app.userRoute`

By default the whole box is a logout button. An app with a profile page gives its route, or the URL of a page outside the app:

```js
new Kernel({
  app: {
    name: 'Book Manager',
    userRoute: 'profile', // a route name ('/me/profile' would be a path), or any RouteLocationRaw
    // userRoute: { name: 'user-show', params: { id: 'me' } },
    // userRoute: 'https://id.example.com/account', // outside the app
  },
})
```

The name, subtitle and avatar then form a real link: middle-click and the keyboard work. A route opens in the app, and the box is highlighted while that page is open. A string starting with `https://`, `http://`, `//` or `mailto:` is an external URL and opens in a new tab; any other string is a route name (a path when it starts with `/`), so a route name may hold a colon. Only the sign-out glyph on the left logs out. When the sidebar is collapsed, that glyph is all that shows, and it still logs out.

## Avatar picture: `app.userAvatar`

The avatar shows the user's picture when the auth user has a URL in `avatar` or `avatarUrl`. When the URL lives elsewhere, the app says where:

```js
app: {
  userAvatar: (user) => user.profile?.photo ?? null,
}
```

With no URL, or when the picture fails to load, the circle shows the user's initials. The image is sent without a referrer.

## Building your own box

`useUserBox()` gives the same values to a custom layout: `displayName`, `subtitle`, `initials`, `avatarUrl`, `avatarFailed` (call it from the img's `error` event) `userRoute`, and `userLink` (what to render and bind for the link). `isExternalUserLink(link)` tells a URL from a route, and `resolveUserAvatar(user, resolver?)` is the URL rule on its own. `DefaultUserInfo`, the zone-based variant, follows the same rules.

The tooltips use `core.actions.logout` and `core.actions.profile` from the [i18n catalog](i18n.md).
