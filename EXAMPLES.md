# qdadm Examples

Live examples demonstrating qdadm features.

## Available Examples

| Example | Description | Demo |
|---------|-------------|------|
| [hello-world](./examples/hello-world/) | Minimal list page (~50 lines) | [Live](https://quazardous.github.io/qdadm/hello-world/) |
| [demo](./packages/demo/) | Full-featured admin demo | [Live](https://quazardous.github.io/qdadm/demo/) |

## Run locally

```bash
# Hello World
cd examples/hello-world
npm install
npm run dev

# Full Demo
cd packages/demo
npm install
npm run dev
```

## What each example shows

### hello-world

The bare minimum to get a qdadm list page working:
- Single EntityManager with MockApiStorage
- One list page component
- ~50 lines total

### demo

Complete admin application showcasing:
- Multiple data sources (Mock, REST API, LocalStorage)
- List pages with search, filters, pagination
- Form pages with validation
- Custom actions (favorite toggle)
- Authentication & impersonation
- Module system architecture
- Responsive layout
