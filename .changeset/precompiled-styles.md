---
"@quazardous/qdadm": minor
---

`import '@quazardous/qdadm/styles'` now loads a stylesheet compiled at publish time, so an app no longer needs sass (#2260). The import is the same, and so is the result.

- The raw SCSS stays available as `@quazardous/qdadm/styles/scss`, for whoever compiles it with their own settings. `@quazardous/qdadm/styles/variables` is unchanged, and both still need sass.
- Theming is unaffected: qdadm's colours are CSS custom properties, set at runtime.
