---
'@quazardous/qdadm': minor
---

One singularizer instead of two, and a navigation to a missing route now says so

`crud()` NAMED routes with six hand-rolled lines while `EntityManager.routePrefix`
LOOKED THEM UP through the vendored `pluralize`. Two engines, and they
disagreed: `crud()` posted `people-show` while `useListPage` asked for
`person-show`, so `router.hasRoute()` was false everywhere. No error at boot,
nothing at all until someone clicked and the row simply did not open.

They agreed on every regular plural — `books`, `categories`, `statuses`,
`boxes`, `addresses` — which is precisely why it went unnoticed. `crud()` now
uses the same engine as everything else.

**Who this changes.** Only entities whose plural is irregular: `people`,
`children`, `analyses`, `criteria`, `indices`, `men`, `feet`. For those, three
derived values change, not one:

| Derived from the entity name | Before | After |
|---|---|---|
| Route prefix | `people-show` | `person-show` |
| Parent route param | `peopleId` | `personId` |
| Child foreign key | `people_id` | `person_id` |

The last one goes **on the wire** to your backend, so read it carefully if you
have such an entity. An explicit `foreignKey`, `parentParam` or `routePrefix`
still wins over the derived value, as before.

An app with an irregular-plural entity cannot have been working without
pinning something already — the two sides disagreed, so navigation was broken.
If you pinned `routePrefix` on the EntityManager to match the old hand-rolled
output, remove the pin or align both sides.

**And the class of failure is no longer silent.** `goToShow`, `goToEdit` and
`goToCreate` now warn, once per route name, when the name they are about to
push does not exist — naming the name, the fact that nothing will happen, and
the prefix they derived it from. The check sits at the moment of navigation
rather than auditing prefixes upfront, because an entity that only ever
appears as a child of another legitimately has no routes under its own prefix,
and a warning nobody trusts is worse than none.
