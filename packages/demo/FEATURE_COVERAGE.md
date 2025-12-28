# qdadm Feature Coverage Audit

> Comprehensive mapping of qdadm framework features to demo app usage.

## Summary

| Category | Features | Covered | Partially | Missing |
|----------|----------|---------|-----------|---------|
| EntityManager CRUD | 6 | 6 | 0 | 0 |
| Permissions | 6 | 6 | 0 | 0 |
| Cache & Filtering | 4 | 3 | 1 | 0 |
| Relations | 4 | 4 | 0 | 0 |
| Zone Registry | 5 | 0 | 0 | 5 |
| Layout Inheritance | 4 | 3 | 1 | 0 |
| Lifecycle Hooks | 3 | 3 | 0 | 0 |
| Alter Hooks | 4 | 1 | 0 | 3 |
| **Total** | **36** | **26** | **2** | **8** |

---

## 1. EntityManager CRUD Operations

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `list()` | `LoanList.vue`, `BookList.vue` | loans, books | COVERED | Used via `useListPageBuilder({ entity })` |
| `get()` | `BookForm.vue`, `LoanForm.vue` | books, loans | COVERED | Called via `useForm({ entity })` |
| `create()` | `BookForm.vue`, `LoanForm.vue` | books, loans | COVERED | `submit()` in create mode |
| `update()` | `BookForm.vue` | books | COVERED | `submit()` in edit mode |
| `patch()` | `LoanList.vue:bulkMarkAsRead()` | loans | COVERED | Partial updates on loans |
| `delete()` | `BookList.vue`, `LoanList.vue` | books, loans | COVERED | `addDeleteAction()` |

---

## 2. Permissions

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `canRead()` | `UsersManager` | users | COVERED | Admin-only users list |
| `canCreate()` | `UsersManager`, nav guards | users | COVERED | Create button visibility |
| `canUpdate()` | `BooksManager`, `LoansManager` | books, loans | COVERED | Edit action visibility |
| `canDelete()` | `BooksManager`, `LoansManager` | books, loans | COVERED | Admin-only delete for books |
| `canList()` | `entityAuthAdapter.js` | all | COVERED | Entity-specific list permissions |
| Row-level silo | `entityAuthAdapter.js:siloRules` | loans | COVERED | User sees only own loans |

---

## 3. Cache & Local Filtering

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `query()` auto-cache | `BookList.vue`, `LoanList.vue` | books, loans | COVERED | via `useListPageBuilder` |
| `localFilterThreshold` | (default 100) | - | COVERED | Uses framework default |
| `local_filter` callback | `LoanList.vue:status` | loans | COVERED | Virtual "status" filter |
| `cacheSafe` param | `LoansManager.list()` | loans | PARTIAL | Used but not explicitly shown in demo pages |

---

## 4. Relations

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| Children config | `main.js:BooksManager` | books | COVERED | `children: { loans: {...} }` |
| Parent config | `main.js:LoansManager` | loans | COVERED | Parent filtering via route meta |
| `listChildren()` | `BookForm.vue:loans tab` | books->loans | COVERED | Shows loans in book edit tabs |
| Parent route filtering | `genres/init.js`, `books/init.js` | genres->books, books->loans | COVERED | Child routes with foreignKey |

---

## 5. Zone Registry

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `defineZone()` | - | - | MISSING | No custom zones defined |
| `registerBlock()` | - | - | MISSING | No blocks registered |
| `getBlocks()` | - | - | MISSING | Not demonstrated |
| `<Zone>` component | - | - | MISSING | Not used in demo pages |
| `unregisterBlock()` | - | - | MISSING | Not demonstrated |

**Recommendation**: Add a sidebar zone to BookForm with custom content blocks.

---

## 6. Layout Inheritance

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `BaseLayout` | `MainLayout.vue` | - | COVERED | Via qdadm default |
| `ListLayout` | `BookList.vue`, `LoanList.vue` | books, loans | COVERED | Auto-detected from route |
| `FormLayout` | `BookForm.vue`, `LoanForm.vue` | books, loans | COVERED | Auto-detected from -edit suffix |
| `DashboardLayout` | - | - | PARTIAL | Exists but not explicitly shown |

---

## 7. Lifecycle Hooks

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `books:presave` | `main.js` | books | COVERED | Adds created_at/updated_at timestamps |
| `books:postsave` | `main.js` | books | COVERED | Logs save operations to console |
| `books:predelete` | `main.js` | books | COVERED | Logs delete operations to console |

Lifecycle hooks are registered after `kernel.createApp()` in main.js to demonstrate
the hook pattern for audit timestamps and logging.

---

## 8. Alter Hooks

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `list:alter` | - | - | MISSING | Not demonstrated |
| `form:alter` | - | - | MISSING | Not demonstrated |
| `menu:alter` | `main.js` | - | COVERED | Demonstrates menu modification pattern |
| `filter:alter` | - | - | MISSING | Not demonstrated |

The `menu:alter` hook is registered in main.js to demonstrate menu modification.
For list:alter and form:alter, see the `extendModule()` helper tests.

---

## 9. Additional Features (Bonus Coverage)

| Feature | Demo Location | Entity | Status | Notes |
|---------|---------------|--------|--------|-------|
| `setSeverityMap()` | `main.js:BooksManager` | books | COVERED | Genre severity colors |
| `getEntityLabel()` | `main.js:LoansManager` | loans | COVERED | Custom label callback |
| `getMany()` batch fetch | `BookForm.vue:usersManager` | users | COVERED | Batch user lookup |
| Custom `list()` override | `LoansManager` | loans | COVERED | Ownership filtering |
| Enrichment pattern | `LoansManager._enrichLoan` | loans | COVERED | Related entity lookups |
| `local_search` callback | `LoanList.vue` | loans | COVERED | Search by book title |
| Bulk actions | `LoanList.vue:markAsRead` | loans | COVERED | Custom bulk operations |
| `addBulkDeleteAction()` | `BookList.vue`, `LoanList.vue` | books, loans | COVERED | Standard bulk delete |
| Route family | `books/init.js` | books | COVERED | `addRouteFamily()` |

---

## Missing Feature Demonstrations (Priority Order)

### High Priority (Core Framework Features)

1. **Zone Registry** - No zones or blocks demonstrated
   - Solution: Add sidebar zone with custom blocks in book/genre forms
   - Example code in main.js comments shows the pattern

2. **list:alter / form:alter / filter:alter hooks** - Not actively used
   - Solution: Create extension module that adds fields to books
   - Tests in `qdadm/tests/core/extension.test.js` show the pattern

### Medium Priority

3. **DashboardLayout** - Exists but not explicitly shown
   - Solution: Add a dashboard/stats page using DashboardLayout

4. **extendModule()** - Module extension helper not demonstrated
   - Solution: Create a "ratings" module that extends books
   - Tests exist but no demo usage

---

## Recommendations

### Quick Wins (Already Implemented)

1. [DONE] Add `presave` hook to update `updated_at` timestamp on books
2. [DONE] Add `postsave` and `predelete` hooks for logging
3. [DONE] Add `menu:alter` hook demonstration

### Remaining Work

1. Use `<Zone>` component in MainLayout for footer/sidebar customization
2. Add `list:alter` hook to add custom columns
3. Add `form:alter` hook to add custom fields
4. Add `filter:alter` hook to modify filter options

### Full Feature Demo (Future)

Create a new "ratings" module that:
- Uses `extendModule()` to add rating column to books list
- Registers `books:form:alter` hook to add rating field
- Adds a block to `book-detail-sidebar` zone
- Demonstrates full hook/zone integration

---

## Audit Metadata

- **Audit Date**: 2025-12-28
- **qdadm Version**: 0.23.0 (target)
- **Demo Location**: `/packages/demo`
- **Auditor**: Agent (T218)
