import { Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'

export class BooksModule extends Module {
  static name = 'books'

  async connect(ctx: any) {
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      children: {
        loans: { entity: 'loans', foreignKey: 'book_id', label: 'Loans' },
      },
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', default: '' },
        year: { type: 'number', label: 'Year', default: null },
      },
      storage: new MockApiStorage({
        entityName: 'books',
        initialData: [
          { id: '1', title: 'Dune', author: 'Frank Herbert', year: 1965 },
          { id: '2', title: 'Neuromancer', author: 'William Gibson', year: 1984 },
        ],
      }),
    }))

    ctx.entity('loans', new EntityManager({
      name: 'loans',
      labelField: 'borrower',
      fields: {
        borrower: { type: 'text', label: 'Borrower', required: true, default: '' },
        book_id: { type: 'text', label: 'Book', default: '' },
        returned: { type: 'boolean', label: 'Returned', default: false },
      },
      storage: new MockApiStorage({
        entityName: 'loans',
        initialData: [
          { id: 'l1', borrower: 'Alice', book_id: '1', returned: false },
          { id: 'l2', borrower: 'Bob', book_id: '1', returned: true },
          { id: 'l3', borrower: 'Carol', book_id: '2', returned: false },
        ],
      }),
    }))

    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      show: () => import('./pages/BookShow.vue'),
      form: () => import('./pages/BookForm.vue'),
    }, { nav: { section: 'Library', icon: 'pi pi-book' } })

    ctx.crud('loans', {
      list: () => import('./pages/BookLoans.vue'),
      form: () => import('./pages/BookLoanForm.vue'),
    }, {
      parentRoute: 'book',
      foreignKey: 'book_id',
      label: 'Loans',
    })
  }
}
