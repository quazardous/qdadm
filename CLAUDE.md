# qdadm

A Vue 3 admin framework: pages are declared, not implemented. Before writing
code on it (a page, a module, an entity), read **[docs/RULES.md](docs/RULES.md)**:
eight rules, each with where it is explained. In short: builders and
`ctx.crud()`, no API call in a page, permissions as grants, every string in
the catalogue, anything slow through the TaskRunner or `useAsyncRead`.

- Where things are: [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md)
- Why: [docs/QDADM_CREDO.md](docs/QDADM_CREDO.md)
- A running app, driven by an agent: [AGENTS.md](AGENTS.md)
- A reference app to copy: `packages/demo` (its `books` and `ops` modules)
