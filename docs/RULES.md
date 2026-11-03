# The rules, short

What qdadm expects of code written on it. Each rule says where it is explained.

1. **Declare, don't implement.** A page is a builder plus a component:
   `useListPage` / `useEntityItemFormPage` / `useEntityItemShowPage`, then
   `<ListPage v-bind="list.props.value" v-on="list.events" />`.
   Columns are `list.generateColumns()` or `list.addColumn()`; fields are
   `form.generateFields()`. ([crud.md](crud.md))
2. **Pages never call a storage, an SDK or `fetch`.** Data goes through an
   `EntityManager` (`ctx.entity(...)`) with its storage. A call that is not
   about one record (a lookup, starting a long task) is a **method of the
   entity's manager** (`suppliers.leadTime(id)`); the page reaches it through
   `useOrchestrator().getManager()` and reads it with `useAsyncRead`. ([QDADM_CREDO.md](QDADM_CREDO.md#2-direct-sdkapi-calls-in-pages))
3. **Entity pages come from `ctx.crud()`,** children with `{ parentRoute }`.
   Routes by hand are for pages that are not an entity's. ([crud.md](crud.md#ctxcrud))
4. **Who may do what is a grant,** in the roles provider:
   `entity:<name>:<action>`, `entity-own:<name>:<action>` with `isOwn`. No
   `role === 'ROLE_ADMIN'` in a component or a manager. ([security.md](security.md#entitymanager-permissions))
5. **Every string on screen is in the catalogue.** Entities: `entities.<e>.label`,
   `.fields.<f>`, `.fields.<f>.options.<value>`; your own text: `ctx.messages()`
   and `t()`. A header goes through `list.column(field)`, never `header="Title"`. ([i18n.md](i18n.md))
6. **Anything slow says it waits.** A long backend task goes through the
   TaskRunner (`useTaskRunner`, a registered kind); a slow read through
   `useAsyncRead` with `QdPending` / `QdPendingZone`. Never an empty area or
   a guessed value. ([tasks.md](tasks.md), [pending.md](pending.md))
7. **One feature, one module.** A `Module` class whose `connect(ctx)` declares
   its messages, entities, pages, menu entries and zone blocks; other modules
   are reached through signals, not imports. ([QDADM_CREDO.md](QDADM_CREDO.md#module-system-v2))
8. **Something qdadm lacks is a framework gap,** not a reason for code of your
   own in the app: say so (an issue, a ticket) rather than work around it.

The demo (`packages/demo`) follows these rules: copy its `books` module for a
CRUD, its `ops` module for tasks and waiting states.
