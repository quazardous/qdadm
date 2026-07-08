/// <reference types="vite/client" />
// vite/client supplies the *.svg / *.scss module shapes that qdadm's shipped
// sources import — a real Vite consumer has this for free.

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// qdadm depends on pluralize, which ships no types; consumers (and this
// fixture) shim it. If qdadm ever bundles the shim, this line can go.
declare module 'pluralize'
