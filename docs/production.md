# Production facts

## What qdadm is

qdadm is a **client-side SPA admin**: the browser runs the whole app (Vue 3, vue-router, PrimeVue).
Server-side rendering and Nuxt are not supported.

## Bundle size

Production builds of the two examples, measured with
`node tools/bundle-size/measure.mjs <dist>` (sizes raw / gzip -9):

| App | First load JS | First load CSS | All JS + CSS |
|---|---|---|---|
| [hello-world](../examples/hello-world) | 707 KB / 193 KB | 80 KB / 15 KB | 1297 KB / 323 KB (7 files) |
| [tutorial-mini-admin](../examples/tutorial-mini-admin) | 752 KB / 207 KB | 83 KB / 15 KB | 1792 KB / 474 KB (28 files) |

- **First load** is what a first visit downloads: the entry script, the modules
  `index.html` preloads, and its stylesheets. The entry carries Vue, vue-router,
  Pinia, PrimeVue's runtime and the qdadm kernel.
- **All JS + CSS** adds the lazy chunks: pages load when their route is visited.
- The tutorial adds auth, a roles provider and more pages to hello-world, and
  that shows in the chunk count far more than in the first load.

The release workflow rebuilds both examples and prints this table in its job
summary on every release. It reports only, and never fails a release.

To measure your own app, build it (`vite build`) and run the script on its
`dist` directory.
