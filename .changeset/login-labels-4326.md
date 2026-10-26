---
'@quazardous/qdadm': minor
---

LoginPage labels (#4326): a `labels` prop replaces any text of the page, with a string (`{name}` placeholders) or a function called at render, over the single label props and the catalogue. In `open` mode the local form gets a title (`localSection`, default "Alternative login"; `''` keeps the bare "or"). Shorter defaults: "Sign in", "My account", "Alternative login" (fr: "Se connecter", "Mon compte", "Login alternatif").
