/// <reference types="vite/client" />
// vite/client supplies the *.svg / *.scss module shapes that qdadm's shipped
// sources import — a real Vite consumer has this for free.

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// pluralize types now travel with qdadm (@types/pluralize in its
// dependencies, #1386) — the fixture deliberately ships NO shim so the
// gate proves consumers don't need one.
