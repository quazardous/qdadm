---
'@quazardous/qdadm': patch
---

Two things the docs never said, both found by a consumer hitting them

**`auth:login` is emitted by `LoginPage`, and by nothing else.** It describes a
screen, not a change of authentication state — and several things wait on it:
the `auth:ready` deferred, the expired-session guard re-arming, role loading in
a `PersistableRolesProvider`, and the live-entity stream. An app that replaced
the login screen gets none of them, and none of them fails loudly. `security.md`
now says so, with the one line that fixes it.

**`live-entities.md` never said when the stream connects.** It does now, as a
table of the three ways into a session — a valid session at boot connects
directly, a `LoginPage` login connects via the signal, and **your own login
screen connects nothing** unless it emits `auth:login` itself. The third row is
the one that bites: pushed updates simply do not arrive for that session, with
no error anywhere.

**And `isAuthenticated()` is synchronous**, which `security.md` now spells out
along with what follows from it: an app whose session lives in a refreshable
token must revalidate *before* mounting, or the route guard runs against a
session not yet restored and drops the user on `/login?session_lost=1` holding a
perfectly valid credential.

No code changed. Every claim in both pages was checked against the source rather
than remembered — a document cannot go red on its own, so it has to be held
against something that can.
