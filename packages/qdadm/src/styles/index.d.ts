// Type companion for the `@quazardous/qdadm/styles` and `@quazardous/qdadm/styles/scss` exports (#1386, #2260).
// They resolve to a stylesheet (compiled .css, or the raw .scss), which TypeScript cannot see through the
// exports map — this empty module makes the side-effect imports typecheck in strict consumers.
export {}
