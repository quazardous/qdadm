<script setup>
/**
 * BookForm - Create/Edit book page
 *
 * Uses useForm for:
 * - Automatic entity loading (in edit mode)
 * - Form state management
 * - Dirty state tracking
 * - Save/Cancel actions
 *
 * In edit mode, shows tabs:
 * - Details: book form fields
 * - Loans: list of loans for this book (child entities)
 */

import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useForm, PageLayout, FormField, FormActions, useOrchestrator, BoolCell } from 'qdadm'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'

const route = useRoute()
const { getManager } = useOrchestrator()

// ============ FORM SETUP ============
const {
  manager,
  form,
  loading,
  saving,
  dirty,
  isEdit,
  submit,
  cancel
} = useForm({
  entity: 'books',
  getId: () => route.params.id
})

// Get field config from manager
const genreField = manager.getFieldConfig('genre')

// ============ CHILD ENTITIES: LOANS ============
const loansManager = getManager('loans')
const usersManager = getManager('users')

const loans = ref([])
const loansLoading = ref(false)
const usersMap = ref({})

// Load loans when editing
onMounted(async () => {
  const bookId = route.params.id
  if (!bookId) return

  loansLoading.value = true
  try {
    // 1. Get loans for this book
    const { items } = await loansManager.list({ book_id: bookId })
    loans.value = items

    // 2. Batch fetch users
    const userIds = [...new Set(items.map(l => l.user_id))]
    if (userIds.length > 0) {
      const users = await usersManager.getMany(userIds)
      usersMap.value = Object.fromEntries(users.map(u => [u.id, u]))
    }
  } finally {
    loansLoading.value = false
  }
})

// Helpers
function getUserName(userId) {
  return usersMap.value[userId]?.username || userId
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

function getStatusSeverity(loan) {
  return loan.returned_at ? 'secondary' : 'success'
}

function getStatusLabel(loan) {
  return loan.returned_at ? 'Returned' : 'Active'
}
</script>

<template>
  <PageLayout
    :title="isEdit ? `Edit ${manager.label}: ${manager.getEntityLabel(form)}` : `Add ${manager.label}`"
    :entity="form"
    :manager="manager"
  >
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
    </div>

    <!-- Create mode: simple form -->
    <Card v-else-if="!isEdit">
      <template #content>
        <div class="form-grid">
          <FormField name="title" label="Title *">
            <InputText v-model="form.title" id="title" class="w-full" />
          </FormField>

          <FormField name="author" label="Author *">
            <InputText v-model="form.author" id="author" class="w-full" />
          </FormField>

          <FormField name="year" label="Year">
            <InputNumber
              v-model="form.year"
              id="year"
              :min="1000"
              :max="new Date().getFullYear()"
              :useGrouping="false"
              class="w-full"
            />
          </FormField>

          <FormField name="genre" label="Genre">
            <Select
              v-model="form.genre"
              :options="genreField.options"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </FormField>
        </div>

        <FormActions
          :isEdit="isEdit"
          :saving="saving"
          :dirty="dirty"
          @save="submit(false)"
          @saveAndClose="submit(true)"
          @cancel="cancel"
        />
      </template>
    </Card>

    <!-- Edit mode: tabs with details + children -->
    <Tabs v-else value="details">
      <TabList>
        <Tab value="details">Details</Tab>
        <Tab value="loans">Loans ({{ loans.length }})</Tab>
      </TabList>

      <TabPanels>
        <!-- Details Tab -->
        <TabPanel value="details">
          <Card>
            <template #content>
              <div class="form-grid">
                <FormField name="title" label="Title *">
                  <InputText v-model="form.title" id="title" class="w-full" />
                </FormField>

                <FormField name="author" label="Author *">
                  <InputText v-model="form.author" id="author" class="w-full" />
                </FormField>

                <FormField name="year" label="Year">
                  <InputNumber
                    v-model="form.year"
                    id="year"
                    :min="1000"
                    :max="new Date().getFullYear()"
                    :useGrouping="false"
                    class="w-full"
                  />
                </FormField>

                <FormField name="genre" label="Genre">
                  <Select
                    v-model="form.genre"
                    :options="genreField.options"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                  />
                </FormField>
              </div>

              <FormActions
                :isEdit="isEdit"
                :saving="saving"
                :dirty="dirty"
                @save="submit(false)"
                @saveAndClose="submit(true)"
                @cancel="cancel"
              />
            </template>
          </Card>
        </TabPanel>

        <!-- Loans Tab -->
        <TabPanel value="loans">
          <Card>
            <template #content>
              <DataTable
                :value="loans"
                :loading="loansLoading"
                dataKey="id"
                stripedRows
              >
                <Column field="user_id" header="Borrower">
                  <template #body="{ data }">
                    {{ getUserName(data.user_id) }}
                  </template>
                </Column>
                <Column field="borrowed_at" header="Borrowed" style="width: 120px">
                  <template #body="{ data }">
                    {{ formatDate(data.borrowed_at) }}
                  </template>
                </Column>
                <Column field="returned_at" header="Returned" style="width: 120px">
                  <template #body="{ data }">
                    {{ formatDate(data.returned_at) }}
                  </template>
                </Column>
                <Column header="Status" style="width: 100px">
                  <template #body="{ data }">
                    <Tag :value="getStatusLabel(data)" :severity="getStatusSeverity(data)" />
                  </template>
                </Column>
                <Column field="read" header="Read" style="width: 80px">
                  <template #body="{ data }">
                    <BoolCell :value="data.read" />
                  </template>
                </Column>

                <template #empty>
                  <div class="text-center p-4 text-color-secondary">
                    No loans for this book
                  </div>
                </template>
              </DataTable>
            </template>
          </Card>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </PageLayout>
</template>

<style scoped>
/* form-grid styles come from qdadm/styles/main.css */

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}
</style>
