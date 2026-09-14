---
"@quazardous/qdadm": minor
---

A list page and its menu entry check `list`, not `read` (#2497).

`read` and `list` are separate grants, but the entity route guard and the menu checked `canRead()` for every entity route. A role granted List without Read lost the menu entry and was refused the list; a role granted Read without List was shown a list it was not allowed to list.

- `ctx.crud()` routes declare the action they perform: `meta.entityAction` is `list` on the list route and `read` on the show route.
- The route guard and the menu check that action — `canList()` for a list. Routes that declare none (custom pages, create, edit) keep checking `canRead()`.
- A custom route can opt in with `meta: { entityAction: 'list' }`.

**Check your managers:** a manager that overrides `canRead()` to restrict access must override `canList()` too, or its list page now follows the plain `entity:<x>:list` grant. `RolesManager` and `UsersManager` do: their lists stay behind `adminPermission`.

**Check your roles:** a role granted `entity:<x>:read` without `entity:<x>:list` no longer sees that entity's list page or its menu entry. Grant `list` where the list should stay visible.
