# Architecture Decision Records

Short records of the structural decisions qdadm rests on — the *why* behind
choices that are expensive to reverse and non-obvious from the code.

These are **dated, immutable records**, which makes them the one deliberate
exception to the current-state-only documentation policy: an ADR describes the
decision as it was made and the constraints that applied then. It is not
reference documentation and is not updated when the code moves. If a decision
is reversed, the fix is a new ADR that supersedes the old one, not an edit.

For how things work today, read [`../architecture.md`](../architecture.md),
[`../QDADM_CREDO.md`](../QDADM_CREDO.md), and the topic docs.

| # | Decision |
|---|---|
| [0001](0001-pac-not-mvc.md) | PAC, not MVC |
| [0002](0002-entitymanager-centric-domain.md) | EntityManager as the single domain layer |
| [0003](0003-ship-raw-sources.md) | Ship raw sources, with a Vite plugin as the consumption contract |
| [0004](0004-extractible-satellites.md) | qdcore / qddebug as extractible satellites |
| [0005](0005-own-i18n-kernel.md) | Own i18n kernel instead of vue-i18n |
| [0006](0006-consumer-smoke-as-stability-contract.md) | The consumer-smoke fixture *is* the stability contract |
| [0007](0007-documentation-policies.md) | Current-state-only docs, lean README |
| [0008](0008-namespaced-local-storage-keys.md) | Namespaced localStorage keys for shared origins |
| [0009](0009-live-entities.md) | Live entities: the app declares which entities the backend mutates out of session *(proposed)* |

## Writing a new one

Copy the shape of any existing record: **Context** (the forces, not the
solution), **Decision** (what was chosen, in the active voice), **Consequences**
(what this costs, including what it makes harder). Half a page. Number
sequentially, never renumber, never delete.
