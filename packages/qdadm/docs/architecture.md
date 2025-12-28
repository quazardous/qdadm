# Architecture

## PAC, not MVC

qdadm follows the **PAC** (Presentation-Abstraction-Control) pattern, not MVC.

### Why PAC?

| Aspect | MVC | PAC |
|--------|-----|-----|
| Presentation | Has some logic | Completely dumb |
| Model/Abstraction | Pure data | Business logic + data |
| Coupling | View can access Model | Complete isolation |
| Testability | Need to test View | View is trivial, test Control |

In PAC, Presentation is "dumb" - zero logic, just renders what Control tells it. This makes:
- Pages trivial to write (~10 lines)
- Business logic concentrated in one place (EntityManager)
- Testing focused on logic, not UI

### The Three Components

```
┌─────────────────────────────────────────┐
│ PRESENTATION (Pages)                    │
│ Pure rendering, no logic                │
│ Uses builders, not direct calls         │
├─────────────────────────────────────────┤
│ ABSTRACTION (EntityManager)             │
│ Business logic, permissions, caching    │
│ "ORM for the frontend"                  │
├─────────────────────────────────────────┤
│ CONTROL (Kernel/Orchestrator)           │
│ Wiring, routing, bootstrap              │
│ Configured once at app start            │
└─────────────────────────────────────────┘
```

## No-Template-ish

Templates exist but are minimal:
- ~10 lines typical
- Pure composition (component assembly)
- Zero logic (`v-if`, `v-for` = smell)
- No inline styles

### What belongs where

| In Template | In Script | In CSS |
|-------------|-----------|--------|
| Component composition | Builder setup | All styling |
| Slot declarations | Event handlers | Layout |
| `v-bind`, `v-on` | Data fetching | Appearance |

### Progressive Customization

When you need more control, add incrementally:

1. **Config only** - Builder options
2. **Config + slots** - Inject components
3. **Config + hooks** - Modify behavior
4. **Minimal template** - Override specific parts
5. **Full template** - Complete control (rare)

No cliff between levels - smooth transition.

## Layer Isolation

Pages never import:
- Storage classes
- SDK/API clients
- Database utilities

Pages only know:
- Entity names (`'books'`, `'users'`)
- Builders (`useListPageBuilder`, `useFormPageBuilder`)
- Standard components (`ListPage`, `FormPage`)

This isolation means swapping storage backends requires zero page changes.

## See Also

- [PAC on Wikipedia](https://en.wikipedia.org/wiki/Presentation–abstraction–control)
- [MVC vs PAC](https://www.garfieldtech.com/blog/mvc-vs-pac)
