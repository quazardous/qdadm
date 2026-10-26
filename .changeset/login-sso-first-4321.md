---
'@quazardous/qdadm': minor
---

LoginPage, identity provider first (#4321): `sso` puts the provider's button first (`href`, `start()`, or the auth adapter's `beginLogin()`), and `localFallback` makes the local form `open`, `collapsed` or `hidden`. Also new: `providerHome` (a link to the provider's portal), `subtitle`, `brandLogo` (slot `brand`) and `error`. An error from the sign-in flow shows above the button. Without `sso` the page is unchanged.
