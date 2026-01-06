/**
 * Unit tests for FormPage component
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import FormPage from '../../src/components/forms/FormPage.vue'

// Mock PrimeVue components
vi.mock('primevue/card', () => ({
  default: {
    name: 'Card',
    template: '<div class="p-card"><slot name="content" /></div>'
  }
}))

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    props: ['label', 'icon', 'severity', 'loading', 'disabled'],
    template: '<button :disabled="disabled" :class="[`p-button-${severity}`]">{{ label }}</button>',
    emits: ['click']
  }
}))

vi.mock('primevue/message', () => ({
  default: {
    name: 'Message',
    props: ['severity', 'closable'],
    template: '<div class="p-message" :class="[`p-message-${severity}`]"><slot /></div>'
  }
}))

// Mock internal components
vi.mock('../../src/components/layout/PageHeader.vue', () => ({
  default: {
    name: 'PageHeader',
    props: ['title', 'titleParts'],
    template: '<div class="page-header"><h1>{{ title || titleParts?.entityLabel }}</h1><slot name="actions" /></div>'
  }
}))

vi.mock('../../src/components/forms/FormActions.vue', () => ({
  default: {
    name: 'FormActions',
    props: ['isEdit', 'saving', 'dirty', 'showSaveAndClose'],
    emits: ['save', 'saveAndClose', 'cancel'],
    template: `
      <div class="form-actions">
        <button @click="$emit('save')" :disabled="!dirty || saving">Save</button>
        <button @click="$emit('saveAndClose')" :disabled="!dirty || saving">Save & Close</button>
        <button @click="$emit('cancel')">Cancel</button>
      </div>
    `
  }
}))

vi.mock('../../src/components/dialogs/UnsavedChangesDialog.vue', () => ({
  default: {
    name: 'UnsavedChangesDialog',
    props: ['visible', 'saving', 'hasOnSave'],
    emits: ['update:visible', 'saveAndLeave', 'leave', 'stay'],
    template: '<div v-if="visible" class="unsaved-dialog">Unsaved changes dialog</div>'
  }
}))

describe('FormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with minimal props', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test Form'
        },
        slots: {
          fields: '<div class="test-fields">Form content</div>'
        }
      })

      expect(wrapper.find('.form-page').exists()).toBe(true)
      expect(wrapper.find('.page-header').exists()).toBe(true)
      expect(wrapper.text()).toContain('Form content')
    })

    it('renders loading state', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Loading Form',
          loading: true
        }
      })

      expect(wrapper.find('.loading-state').exists()).toBe(true)
      expect(wrapper.find('.pi-spinner').exists()).toBe(true)
    })

    it('renders error state with fetchError string', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Error Form',
          fetchError: 'Failed to load entity'
        }
      })

      expect(wrapper.find('.p-message-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Failed to load entity')
    })

    it('renders error state with fetchError object', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Error Form',
          fetchError: { message: 'Network error' }
        }
      })

      expect(wrapper.text()).toContain('Network error')
    })

    it('renders form content when not loading and no error', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test Form'
        },
        slots: {
          fields: '<input type="text" id="test-input" />'
        }
      })

      expect(wrapper.find('#test-input').exists()).toBe(true)
    })
  })

  describe('slots', () => {
    it('renders nav slot', () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test' },
        slots: {
          nav: '<nav class="custom-nav">Navigation</nav>',
          fields: '<div>Fields</div>'
        }
      })

      expect(wrapper.find('.custom-nav').exists()).toBe(true)
    })

    it('renders toolbar slot', () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test' },
        slots: {
          toolbar: '<div class="custom-toolbar">Toolbar</div>',
          fields: '<div>Fields</div>'
        }
      })

      expect(wrapper.find('.custom-toolbar').exists()).toBe(true)
    })

    it('renders header-actions slot', () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test' },
        slots: {
          'header-actions': '<button class="custom-action">Custom</button>',
          fields: '<div>Fields</div>'
        }
      })

      expect(wrapper.find('.custom-action').exists()).toBe(true)
    })

    it('renders footer slot instead of FormActions', () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test' },
        slots: {
          fields: '<div>Fields</div>',
          footer: '<div class="custom-footer">Custom Footer</div>'
        }
      })

      expect(wrapper.find('.custom-footer').exists()).toBe(true)
    })

    it('renders custom loading slot', () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test', loading: true },
        slots: {
          loading: '<div class="custom-loading">Loading...</div>'
        }
      })

      expect(wrapper.find('.custom-loading').exists()).toBe(true)
    })

    it('renders custom error slot', () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test', fetchError: 'Error' },
        slots: {
          error: '<div class="custom-error">Custom error display</div>'
        }
      })

      expect(wrapper.find('.custom-error').exists()).toBe(true)
    })
  })

  describe('events', () => {
    it('emits save event from FormActions', async () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test', dirty: true },
        slots: { fields: '<div>Fields</div>' }
      })

      await wrapper.find('.form-actions button:first-child').trigger('click')
      expect(wrapper.emitted('save')).toBeTruthy()
    })

    it('emits saveAndClose event from FormActions', async () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test', dirty: true },
        slots: { fields: '<div>Fields</div>' }
      })

      await wrapper.find('.form-actions button:nth-child(2)').trigger('click')
      expect(wrapper.emitted('saveAndClose')).toBeTruthy()
    })

    it('emits cancel event from FormActions', async () => {
      const wrapper = mount(FormPage, {
        props: { title: 'Test' },
        slots: { fields: '<div>Fields</div>' }
      })

      await wrapper.find('.form-actions button:last-child').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('actions', () => {
    it('renders header actions from props', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          actions: [
            { name: 'export', label: 'Export', icon: 'pi pi-download', severity: 'info', onClick: vi.fn() }
          ]
        },
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.text()).toContain('Export')
    })

    it('excludes save/delete/cancel from header actions', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          actions: [
            { name: 'save', label: 'Save', onClick: vi.fn() },
            { name: 'delete', label: 'Delete', onClick: vi.fn() },
            { name: 'cancel', label: 'Cancel', onClick: vi.fn() },
            { name: 'export', label: 'Export', onClick: vi.fn() }
          ]
        },
        slots: { fields: '<div>Fields</div>' }
      })

      // Only Export should be in header, not save/delete/cancel
      const headerButtons = wrapper.findAll('.page-header button')
      expect(headerButtons.length).toBe(1)
      expect(headerButtons[0].text()).toBe('Export')
    })
  })

  describe('validation', () => {
    it('shows error summary when provided', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          errorSummary: [
            { field: 'title', label: 'Title', message: 'Title is required' },
            { field: 'author', label: 'Author', message: 'Author is required' }
          ]
        },
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.find('.validation-summary').exists()).toBe(true)
      expect(wrapper.text()).toContain('Title is required')
      expect(wrapper.text()).toContain('Author is required')
    })

    it('does not show error summary when empty', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          errorSummary: []
        },
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.find('.validation-summary').exists()).toBe(false)
    })
  })

  describe('UI options', () => {
    it('hides FormActions when showFormActions is false', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          showFormActions: false
        },
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.find('.form-actions').exists()).toBe(false)
    })

    it('renders without card when cardWrapper is false', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          cardWrapper: false
        },
        slots: { fields: '<div class="my-fields">Fields</div>' }
      })

      expect(wrapper.find('.p-card').exists()).toBe(false)
      expect(wrapper.find('.my-fields').exists()).toBe(true)
    })
  })

  describe('guard dialog', () => {
    it('renders UnsavedChangesDialog when guardDialog is provided', () => {
      const guardDialog = {
        visible: ref(true),  // Must be a ref for .value access in FormPage
        onSave: vi.fn(),
        onLeave: vi.fn(),
        onStay: vi.fn()
      }

      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          guardDialog
        },
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.find('.unsaved-dialog').exists()).toBe(true)
    })

    it('does not render UnsavedChangesDialog when guardDialog is null', () => {
      const wrapper = mount(FormPage, {
        props: {
          title: 'Test',
          guardDialog: null
        },
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.find('.unsaved-dialog').exists()).toBe(false)
    })
  })

  describe('props integration with useFormPageBuilder', () => {
    it('accepts all props from builder.props pattern', () => {
      // Simulating the props object from useFormPageBuilder
      const builderProps = {
        isEdit: true,
        mode: 'edit',
        loading: false,
        saving: false,
        dirty: true,
        title: 'Edit Book: The Great Gatsby',
        titleParts: { action: 'Edit', entityName: 'Book', entityLabel: 'The Great Gatsby' },
        fields: [{ name: 'title', type: 'text', label: 'Title' }],
        actions: [],
        errors: {},
        hasErrors: false,
        errorSummary: null,
        submitted: false,
        guardDialog: null
      }

      const wrapper = mount(FormPage, {
        props: builderProps,
        slots: { fields: '<div>Fields</div>' }
      })

      expect(wrapper.find('.form-page').exists()).toBe(true)
    })
  })
})
