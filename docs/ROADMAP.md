# qdadm Roadmap

Planned work, in rough priority order. Not a commitment — tickets drive the
actual scheduling.

## 3.0 — massive multi-agent

The next major is reserved for it. Nothing else takes the number: 3.0 should
mean the framework changed in kind, not that a declaration was corrected.

That rule has already cost something, which is the point of writing it down.
Two changes shipped in 2.x carried real upgrade notes — an optional peer that
became genuinely optional, and Kernel properties whose types stopped promising
a `null` that could no longer occur — and both were briefly marked as majors
before being put back. Neither changed what qdadm *is*. Read their CHANGELOG
entries before upgrading anyway; a minor is not a synonym for silent.

## File Upload Component

Upload on select, return ID/URL for entity reference.

```vue
<FileUpload
  v-model="form.avatar_id"
  endpoint="/api/uploads"
  accept="image/*"
  :max-size="5 * 1024 * 1024"
  preview
  @uploaded="file => form.avatar_url = file.url"
/>
```

- User selects file → upload starts immediately, progress bar
- On complete, `v-model` receives the file ID/URL — form save only sends the
  reference
- Drag & drop, image preview, multiple files (`v-model` = array), delete
  before save, size/type validation, retry on failure
- Backend contract: `POST /api/uploads` (multipart) →
  `{ id, url, name }`; orphan cleanup is the backend's job

## Built-in validator shortcuts

Field validation exists (`validator` functions on field config, schema-derived
checks, submit gating). Missing: the declarative shortcuts —

```js
fields: {
  email: { type: 'email', validate: 'email' },        // named validator
  username: { type: 'text', validate: ['min:3', /^[a-z0-9]+$/] },
}
```

Candidate built-ins: `required`, `email`, `url`, `min:N`, `max:N`,
`pattern:/…/`, `in:a,b,c` — plus async validators with per-field pending
state.
