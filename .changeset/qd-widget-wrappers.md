---
'@quazardous/qdadm': patch
---

QdButton / QdMessage wrappers (#1391): the framework's 24 raw
primevue/button and primevue/message imports now go through two thin
pass-through components (components/base/, exported), concentrating any
future widget-library divergence into two files. An ESLint
no-restricted-imports guard keeps raw imports from creeping back.
Zero visual or behavioral change; flavor-compatible by construction.
