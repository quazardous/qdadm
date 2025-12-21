<script setup>
/**
 * MultiStepDialog - Reusable multi-step form dialog
 *
 * Features:
 * - Step indicator with labels
 * - Automatic navigation buttons (Cancel, Back, Next, Submit)
 * - Per-step validation
 * - Linear progression mode
 * - Loading state for submit
 * - Customizable button labels
 *
 * Usage:
 *   <MultiStepDialog
 *     v-model:visible="showDialog"
 *     v-model:step="currentStep"
 *     title="Create Item"
 *     :steps="[
 *       { label: 'Step 1', valid: !!field1 },
 *       { label: 'Step 2', valid: canSubmit }
 *     ]"
 *     :loading="submitting"
 *     @submit="handleSubmit"
 *     @cancel="handleCancel"
 *   >
 *     <template #step-1>
 *       <!-- Step 1 content -->
 *     </template>
 *     <template #step-2>
 *       <!-- Step 2 content -->
 *     </template>
 *   </MultiStepDialog>
 *
 * Props:
 *   - visible: boolean (v-model) - controls dialog visibility
 *   - step: number (v-model) - current step (1-indexed)
 *   - title: string - dialog title
 *   - steps: Array<{ label: string, valid?: boolean }> - step definitions
 *   - loading: boolean - shows loading state on submit button
 *   - width: string - dialog width (default: '800px')
 *   - linear: boolean - require validation before next step (default: true)
 *   - submitLabel: string - label for submit button (default: 'Submit')
 *   - cancelLabel: string - label for cancel button (default: 'Cancel')
 *   - nextLabel: string - label for next button (default: 'Next')
 *   - backLabel: string - label for back button (default: 'Back')
 *   - showBackOnFirst: boolean - show back button on first step (default: false)
 *   - hideStepIndicator: boolean - hide the step indicator (default: false)
 *
 * Events:
 *   - submit: emitted when submit button is clicked on last step
 *   - cancel: emitted when cancel button is clicked
 *   - step-change: emitted when step changes, payload: { from, to }
 *
 * Slots:
 *   - step-{n}: content for step n (1-indexed)
 *   - step-{n}-header: optional header content for step n (shown above step content)
 *   - actions: override action buttons (receives { step, isFirst, isLast, canProceed, goNext, goPrev, submit, cancel })
 */
import { computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import Step from 'primevue/step'
import StepPanels from 'primevue/steppanels'
import StepPanel from 'primevue/steppanel'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  step: {
    type: Number,
    default: 1
  },
  title: {
    type: String,
    default: ''
  },
  steps: {
    type: Array,
    required: true,
    validator: (v) => v.every(s => typeof s.label === 'string')
  },
  loading: {
    type: Boolean,
    default: false
  },
  width: {
    type: String,
    default: '800px'
  },
  linear: {
    type: Boolean,
    default: true
  },
  submitLabel: {
    type: String,
    default: 'Submit'
  },
  cancelLabel: {
    type: String,
    default: 'Cancel'
  },
  nextLabel: {
    type: String,
    default: 'Next'
  },
  backLabel: {
    type: String,
    default: 'Back'
  },
  showBackOnFirst: {
    type: Boolean,
    default: false
  },
  hideStepIndicator: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'update:step', 'submit', 'cancel', 'step-change'])

// Current step (1-indexed)
const currentStep = computed({
  get: () => props.step,
  set: (v) => emit('update:step', v)
})

// Step helpers
const isFirstStep = computed(() => currentStep.value === 1)
const isLastStep = computed(() => currentStep.value === props.steps.length)

// Current step definition
const currentStepDef = computed(() => props.steps[currentStep.value - 1] || {})

// Can proceed to next step (validation)
const canProceed = computed(() => {
  if (!props.linear) return true
  return currentStepDef.value.valid !== false
})

// Can submit (last step validation)
const canSubmit = computed(() => {
  return currentStepDef.value.valid !== false
})

// Navigation
function goNext() {
  if (!isLastStep.value && canProceed.value) {
    const from = currentStep.value
    const to = currentStep.value + 1
    currentStep.value = to
    emit('step-change', { from, to })
  }
}

function goPrev() {
  if (!isFirstStep.value) {
    const from = currentStep.value
    const to = currentStep.value - 1
    currentStep.value = to
    emit('step-change', { from, to })
  }
}

function goToStep(stepNumber) {
  if (stepNumber >= 1 && stepNumber <= props.steps.length) {
    // In linear mode, can only go back or to current+1 if valid
    if (props.linear && stepNumber > currentStep.value) {
      if (stepNumber > currentStep.value + 1 || !canProceed.value) {
        return
      }
    }
    const from = currentStep.value
    currentStep.value = stepNumber
    emit('step-change', { from, to: stepNumber })
  }
}

function submit() {
  if (canSubmit.value) {
    emit('submit')
  }
}

function cancel() {
  emit('cancel')
  emit('update:visible', false)
}

// Reset to first step when dialog opens
watch(() => props.visible, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    // Don't reset if step is explicitly set
    // currentStep.value = 1
  }
})

// Expose for slot actions
const slotActions = computed(() => ({
  step: currentStep.value,
  isFirst: isFirstStep.value,
  isLast: isLastStep.value,
  canProceed: canProceed.value,
  canSubmit: canSubmit.value,
  goNext,
  goPrev,
  goToStep,
  submit,
  cancel
}))
</script>

<template>
  <Dialog
    :visible="props.visible"
    @update:visible="emit('update:visible', $event)"
    :header="title"
    :style="{ width: width }"
    :modal="true"
    :closable="!loading"
    :closeOnEscape="!loading"
  >
    <div class="multi-step-dialog">
      <Stepper v-model:value="currentStep" :linear="linear">
        <!-- Step indicator -->
        <StepList v-if="!hideStepIndicator">
          <Step
            v-for="(stepDef, idx) in steps"
            :key="idx"
            :value="idx + 1"
          >
            {{ stepDef.label }}
          </Step>
        </StepList>

        <!-- Step panels -->
        <StepPanels>
          <StepPanel
            v-for="(stepDef, idx) in steps"
            :key="idx"
            :value="idx + 1"
          >
            <div class="step-content">
              <!-- Optional step header slot -->
              <slot :name="`step-${idx + 1}-header`" v-bind="slotActions" />

              <!-- Step content slot -->
              <slot :name="`step-${idx + 1}`" v-bind="slotActions" />

              <!-- Action buttons -->
              <div class="step-actions">
                <slot name="actions" v-bind="slotActions">
                  <!-- Back button -->
                  <Button
                    v-if="!isFirstStep || showBackOnFirst"
                    :label="backLabel"
                    icon="pi pi-arrow-left"
                    severity="secondary"
                    @click="goPrev"
                    :disabled="loading || isFirstStep"
                  />

                  <!-- Cancel button -->
                  <Button
                    :label="cancelLabel"
                    severity="secondary"
                    @click="cancel"
                    :disabled="loading"
                  />

                  <!-- Next button (not on last step) -->
                  <Button
                    v-if="!isLastStep"
                    :label="nextLabel"
                    icon="pi pi-arrow-right"
                    iconPos="right"
                    @click="goNext"
                    :disabled="!canProceed"
                  />

                  <!-- Submit button (only on last step) -->
                  <Button
                    v-if="isLastStep"
                    :label="submitLabel"
                    icon="pi pi-check"
                    @click="submit"
                    :loading="loading"
                    :disabled="!canSubmit"
                  />
                </slot>
              </div>
            </div>
          </StepPanel>
        </StepPanels>
      </Stepper>
    </div>
  </Dialog>
</template>

<style scoped>
.multi-step-dialog {
  padding: 0.5rem 0;
}

.step-content {
  padding: 1rem 0;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200);
}
</style>
