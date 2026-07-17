# PrimeVue — status, coupling map, strategy

## Situation

- qdadm pins **PrimeVue 4** (`peerDependencies: primevue ^4.0.0`) — the MIT
  line. Combined installs (`npm install @quazardous/qdadm primevue …`)
  resolve a 4.x automatically thanks to the peer range.
- **PrimeVue 5+ is not open source.** PrimeTek moved the Prime libraries
  under the commercial **PrimeUI** license (free Community tier gated on
  revenue/team size; paid Commercial Suite otherwise). See
  [primeui.dev/nextchapter](https://primeui.dev/nextchapter).
- **PrimeVue 4 stays MIT forever** but its repository is archived —
  the 4.x line is frozen (no further releases).

**qdadm's stance: stay on the MIT 4.x line.** Widening the peer to v5 would
pull every qdadm consumer into PrimeUI licensing; that is not a decision a
framework should make for its users.

⚠️ Consequence for consumers: a standalone `npm install primevue` now
resolves 5.x (npm `latest`) and ERESOLVEs against qdadm's peer — that
conflict is the guard rail working. Install PrimeVue together with qdadm
(as the tutorial does) or pin `primevue@4`.

## Coupling map

47 PrimeVue modules used across 43 framework files (count = files using
the module):

| Uses | Modules |
|-----:|---------|
| 18 | `button` |
| 9 | `inputtext` |
| 6 | `autocomplete`, `message` |
| 4 | `select`, `chip`, `column`, `tag` |
| 3 | `dialog`, `datatable`, `card`, `useconfirm` |
| 2 | `slider`, `checkbox`, `textarea`, `breadcrumb`, `password`, `toast`, `usetoast` |
| 1 | `stepper` family (×5), `tabs` family (×5), `accordion` family (×4), `inputgroup`(+addon), `selectbutton`, `paginator`, `confirmdialog`, `inputicon`, `iconfield`, `splitbutton`, `fieldset`, `inputnumber`, `datepicker`, `toastservice`, `confirmationservice`, `tooltip` |

Structure of the exposure:

- **Form inputs** (`inputtext`, `select`, `checkbox`, `datepicker`,
  `inputnumber`, `textarea`, `password`, `autocomplete`…) are ALREADY
  funneled through qdadm's `FormInput`/`FormField` — one indirection layer
  exists; swapping the underlying widgets is localized.
- **`button` (18 files) and `message`** are used directly everywhere — the
  widest raw exposure, and the cheapest to wrap.
- **`datatable`/`column`/`paginator`** sit behind `ListPage` — heavy but
  contained in the list layer.
- **Services** (`toast`, `confirm`) are already abstracted behind the
  orchestrator/Kernel (components rarely touch them directly).

## Strategy (decided)

qdadm **stays on the MIT PrimeVue 4 line** and keeps the exit viable:

- **Watch the ecosystem**: community continuations of the MIT v4 line
  already exist. **Primary candidate: [OpenVue](https://github.com/openvi-foundation/openvue)**
  — the openvi-foundation forked the FULL constellation the day of the
  archival (`openvue`, `openicons`, `openux` for the @primeuix layer,
  `openvue-tailwind`) and publishes on npm (`openvue`, MIT). Also watched:
  [BumbleVue](https://github.com/CJDevStudios/bumblevue) (active fixes,
  main repo only). Both are young; adoption waits for traction and a
  stable v4 drop-in API — and goes through the flavor mechanism, not a
  hard switch.
- **Shrink raw exposure** progressively so that any exit (fork or another
  MIT library) stays cheap: the widest raw touchpoints (`button`,
  `message`) go behind qdadm wrappers first; form inputs, tables and
  services are already behind qdadm indirection.
- **No PrimeUI licensing** at the framework level — that would be a
  per-consumer legal decision qdadm refuses to impose.
