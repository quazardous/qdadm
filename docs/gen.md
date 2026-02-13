# Gen Module

Schema-driven code generation for admin interfaces.

## Problem

How to bridge different schema sources (OpenAPI, manual definitions) to a unified entity model?

**Without gen:**
```js
// Each project reimplements schema parsing
const openApiSpec = await fetch('/api/openapi.json')
const entities = customParsing(openApiSpec)  // Different every time
const managers = buildManagers(entities)      // Inconsistent output
```

**With gen:**
```js
import { OpenAPIConnector, createManagers } from 'qdadm/gen'

const connector = new OpenAPIConnector()
const schemas = connector.parse(openApiSpec)
const managers = createManagers(schemas, { storage: ApiStorage })
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Schema Sources                        │
│  OpenAPI 3.x   │   Manual Defs   │   Pydantic (future)  │
└────────┬───────┴────────┬────────┴──────────┬───────────┘
         │                │                    │
         ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                      Connectors                          │
│  OpenAPIConnector  │  ManualConnector  │  BaseConnector  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  UnifiedEntitySchema[]                   │
│        Canonical format for entities and fields          │
└────────────────────────────┬────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────────┐    ┌───────────────┐
│ createManagers │  │ generateManagers │  │ Custom output │
│  (runtime)     │  │  (build-time)    │  │               │
└─────────────┘    └─────────────────┘    └───────────────┘
```

## UnifiedEntitySchema

Canonical schema format all connectors produce:

```js
// Entity
{
  name: 'users',                    // Entity name (plural)
  endpoint: '/api/users',           // API endpoint
  label: 'User',                    // Singular label
  labelPlural: 'Users',             // Plural label
  labelField: 'username',           // Display field
  idField: 'id',                    // Primary key
  readOnly: false,                  // CRUD permissions
  fields: { ... },                  // Field definitions
  extensions: { ... }               // Custom data
}

// Field
{
  name: 'email',
  type: 'email',                    // UnifiedFieldType
  label: 'Email Address',
  required: true,
  readOnly: false,
  format: 'email',                  // Original format hint
  enum: ['a', 'b'],                 // Allowed values
  reference: { entity: 'roles' },   // FK relation
  extensions: { ... }
}
```

### UnifiedFieldType

| Type | UI Input | JSON Schema Origin |
|------|----------|-------------------|
| `text` | Text input | string |
| `number` | Number input | integer, number |
| `boolean` | Checkbox | boolean |
| `date` | Date picker | string + format:date |
| `datetime` | Datetime picker | string + format:date-time |
| `email` | Email input | string + format:email |
| `url` | URL input | string + format:uri |
| `uuid` | Text (UUID) | string + format:uuid |
| `array` | Multi-value | array |
| `object` | JSON editor | object |

## Connectors

### OpenAPIConnector

Parse OpenAPI 3.x specs into UnifiedEntitySchema:

```js
import { OpenAPIConnector } from 'qdadm/gen'

// Basic usage
const connector = new OpenAPIConnector()
const schemas = connector.parse(openapiSpec)

// Custom path patterns (versioned API)
const connector = new OpenAPIConnector({
  pathPatterns: [
    /^\/api\/v1\/([a-z-]+)\/?$/,
    /^\/api\/v1\/([a-z-]+)\/\{[^}]+\}$/
  ]
})

// Custom response wrapper (default: 'data')
const connector = new OpenAPIConnector({
  dataWrapper: 'result'  // For { result: { ... } } responses
})

// Filter operations
const connector = new OpenAPIConnector({
  operationFilter: (path, method, op) => !op.tags?.includes('internal')
})

// Warnings mode
const { schemas, warnings } = connector.parseWithWarnings(spec)
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pathPatterns` | `RegExp[]` | `/api/entity` | Patterns to extract entity name |
| `dataWrapper` | `string` | `'data'` | Property wrapping response data |
| `operationFilter` | `Function` | - | Filter operations to include |
| `customMappings` | `object` | - | Custom type/format mappings |
| `strict` | `boolean` | `false` | Throw on validation errors |

### ManualConnector

Define entities inline without external schema:

```js
import { ManualConnector } from 'qdadm/gen'

const connector = new ManualConnector()
const schemas = connector.parse([
  {
    name: 'users',
    endpoint: '/api/users',
    fields: {
      id: { name: 'id', type: 'number', readOnly: true },
      email: { name: 'email', type: 'email', required: true },
      status: { name: 'status', type: 'text', enum: ['active', 'inactive'] }
    }
  }
])
```

### Custom Connector

Extend `BaseConnector` for custom schema sources:

```js
import { BaseConnector } from 'qdadm/gen'

class PydanticConnector extends BaseConnector {
  parse(source) {
    // Transform Pydantic models to UnifiedEntitySchema[]
    return source.models.map(model => ({
      name: model.name.toLowerCase() + 's',
      endpoint: `/api/${model.name.toLowerCase()}s`,
      fields: this._transformFields(model.fields)
    }))
  }
}
```

## FieldMapper

Convert JSON Schema types to UnifiedFieldType:

```js
import { getDefaultType, BASE_TYPE_MAPPINGS, FORMAT_MAPPINGS } from 'qdadm/gen'

// Type detection
getDefaultType({ type: 'string' })                    // 'text'
getDefaultType({ type: 'string', format: 'email' })   // 'email'
getDefaultType({ type: 'string', enum: ['a', 'b'] })  // 'select'

// Custom mappings
getDefaultType({ type: 'string', format: 'phone' }, {
  formats: { phone: 'text' }
})
```

## Generators

### createManagers (Runtime)

Create EntityManager instances at runtime:

```js
import { createManagers } from 'qdadm/gen'

const managers = createManagers(schemas, {
  storage: ApiStorage,
  storageOptions: { baseUrl: '/api' }
})

// Returns: { users: EntityManager, posts: EntityManager, ... }
```

### generateManagers (Build-time)

Generate static EntityManager files:

```js
// vite.config.js
import { generateManagers } from 'qdadm/gen'

export default {
  plugins: [
    generateManagers({
      source: './openapi.json',
      output: './src/managers/',
      connector: 'openapi'
    })
  ]
}
```

## Decorators

Per-entity field customization:

```js
import { applyDecorators } from 'qdadm/gen'

const decorated = applyDecorators(schemas, {
  users: {
    fields: {
      password: { hidden: true },
      role: { label: 'User Role' }
    }
  }
})
```

## Best Practices

1. **One connector per source type** - OpenAPI, Pydantic, manual
2. **Use decorators for UI tweaks** - Don't modify schema source
3. **Prefer runtime for flexibility** - Build-time for performance
4. **Keep extensions namespaced** - `extensions: { myApp: { ... } }`

## Project-Specific Patterns

When OpenAPIConnector defaults don't match your API:

```js
// Skybot example: /api/admin/* and /api/v1/*
const connector = new OpenAPIConnector({
  pathPatterns: [
    /^\/api\/admin\/([a-z]+)$/,
    /^\/api\/admin\/([a-z]+)\/\{[^}]+\}$/,
    /^\/api\/v1\/([a-z]+)\/?$/,
    /^\/api\/v1\/([a-z]+)\/\{[^}]+\}$/
  ],
  dataWrapper: 'data'
})
```

This keeps the connector generic while supporting custom URL patterns.
