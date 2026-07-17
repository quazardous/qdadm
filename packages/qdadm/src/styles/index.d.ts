// Type companion for the `@quazardous/qdadm/styles` export (#1386).
// The export resolves to a .scss file, which TypeScript cannot see through
// the exports map — this empty module makes the side-effect import
// `import '@quazardous/qdadm/styles'` typecheck in strict consumers.
export {}
