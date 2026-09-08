---
'@quazardous/qdadm': minor
---

A misspelled config key now says so, starting where it costs most

`sse` was the only configuration whose keys were checked. Every other one
accepted anything in silence — including the top level, where the cost is
highest: a misspelled key there does not degrade a feature, it removes a whole
**section** of configuration. `securty:` means no security config at all, so
every check falls through to its default and the app is open where its author
believed it closed. TypeScript catches that; consumers whose module files are
plain JavaScript get nothing.

Unknown keys are now reported for `KernelOptions` and for `security`, in the
shape #1898 established: the warning names what happens **instead**, because
"ignored" reads as "no effect" rather than "falls back to something else".

Suggestions got better in the process, and `sse` inherits it: the old matcher
only caught case differences and prefixes, so `securty` suggested nothing at
all. It now tolerates a missing, inserted, substituted or transposed letter.

Deliberately **not** validated: `debugBar`, whose extra keys are forwarded to
the DebugModule on purpose. A warning that cries wolf is worse than none, and
this is not "validate everything" — see
[ADR 0011](docs/adr/0011-no-silent-no-ops.md).

The known-key list is compared against the `KernelOptions` interface by a
test, so it cannot quietly fall behind and start warning about options that do
work.
