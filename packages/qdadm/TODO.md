# qdadm TODO

## High Priority

### Validation Framework

Automatic validation system - no template changes required.

**EntityManager field definition:**
```javascript
fields: {
  username: {
    type: 'text',
    required: true,
    validate: [
      val => val.length >= 3 || 'Min 3 characters',
      val => /^[a-z0-9]+$/.test(val) || 'Alphanumeric only',
      async val => await checkUnique(val) || 'Already taken'
    ]
  },
  email: {
    type: 'email',
    validate: 'email'  // built-in validator
  }
}
```

**Automatic behavior (no template changes):**
- `FormField` auto-detects validation from manager fields
- Invalid field gets `p-invalid` class (red border)
- Error message appears below field (small red text)
- Validation triggers on blur + submit
- `useForm.save()` blocks if validation fails
- **Quit page guard integration:**
  - "Save" in guard dialog validates first
  - If validation fails → stay on page, show errors
  - "Discard" always works (no validation)

**Implementation:**
```javascript
// useForm internally
const errors = ref({})  // { fieldName: 'error message' }
const validate = async () => {
  errors.value = await manager.validateFields(form)
  return Object.keys(errors.value).length === 0
}

// FormField auto-renders error
<div class="p-field">
  <label>{{ label }}</label>
  <slot />  <!-- input gets :class="{ 'p-invalid': error }" -->
  <small v-if="error" class="p-error">{{ error }}</small>
</div>
```

**Built-in validators:**
- `required` - not empty
- `email` - valid email format
- `url` - valid URL
- `min:3` - min length
- `max:100` - max length
- `pattern:/regex/` - regex match
- `in:a,b,c` - value in list

### i18n Support

Integration with vue-i18n for internationalization.

```javascript
// Kernel config - pass vue-i18n instance
const kernel = new Kernel({
  i18n: i18n  // vue-i18n instance
})

// Framework uses $t internally
toast.add({ summary: t('qdadm.entity.saved') })
```

**Default keys provided by framework:**
```json
{
  "qdadm": {
    "actions": { "save": "Save", "cancel": "Cancel", "delete": "Delete" },
    "messages": { "saved": "{entity} saved", "deleted": "{entity} deleted" },
    "validation": { "required": "Required", "email": "Invalid email" }
  }
}
```

**Features:**
- Optional: works without i18n (falls back to English)
- Ships default EN translations
- Apps merge their own translations

### File Upload Component

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

**Flow:**
1. User selects file → upload starts immediately
2. Progress bar shows upload status
3. On complete → `v-model` receives file ID/URL
4. Form save only sends the reference (instant)

**Features:**
- Drag & drop
- Image preview (before + after upload)
- Progress bar
- Multiple files (`v-model` = array of IDs)
- Delete uploaded file (before save)
- Validation (size, type)
- Retry on failure

**Backend contract:**
```javascript
// POST /api/uploads
// Body: multipart/form-data
// Response: { id: "file_123", url: "/files/file_123.jpg", name: "avatar.jpg" }
```

**Orphan cleanup:** Backend should cleanup files not referenced after X hours.

## Out of Scope

### Entity Caching

Caching is not managed by the framework. Each EntityManager can implement its own cache:

```javascript
class CachedUsersManager extends EntityManager {
  _cache = new Map()
  async list(params) {
    const key = JSON.stringify(params)
    if (this._cache.has(key)) return this._cache.get(key)
    const result = await this.storage.list(params)
    this._cache.set(key, result)
    return result
  }
}
```
