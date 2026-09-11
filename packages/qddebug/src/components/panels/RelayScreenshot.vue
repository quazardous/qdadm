<script setup lang="ts">
/**
 * The debug bar's 📷 and the offer of real screenshots (#2318).
 *
 * - The 📷 (the bar calls `start`): without a real capture, a prompt first; then the annotator; Send posts to the chat.
 * - An agent screenshot rendered from the page: the same offer as a corner notice. It blocks nothing, and the
 *   collector takes it away after 10 s.
 *
 * Teleported to <body> inside its own `.qd-debug` root, like the annotator: page tools treat it as the debug bar.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { RelayChatImageLike, RelayCollector } from '../../collectors/RelayCollector'
import ScreenshotAnnotator from './ScreenshotAnnotator.vue'
import { CAPTURE_PROMPT, ScreenshotFlow } from './screenshotFlow'

const props = defineProps<{ collector: RelayCollector }>()
const emit = defineEmits<{ sent: [] }>()

const tick = ref(0)
const bump = () => {
  tick.value++
}
const stopListening = props.collector.onNotify(bump)

const flow = new ScreenshotFlow(props.collector, { change: bump, sent: () => emit('sent') })
const step = computed(() => {
  void tick.value
  return flow.step
})
const shot = computed(() => {
  void tick.value
  return flow.shot
})
const waiting = computed(() => {
  void tick.value
  return flow.waiting
})
const promptNote = computed(() => {
  void tick.value
  return flow.promptNote
})
// The prompt waits for a real capture, however it starts.
watch(
  () => {
    void tick.value
    return props.collector.captureActive
  },
  (active) => {
    if (active) void flow.captureStarted()
  }
)
/** The 📷 prompt already asks: no corner notice on top of it. */
const notice = computed(() => {
  void tick.value
  return props.collector.captureNotice && flow.step === 'idle'
})

const captureError = ref<string | null>(null)
const error = computed(() => {
  void tick.value
  return flow.error ?? captureError.value
})
const dismissError = () => {
  captureError.value = null
  flow.dismissError()
}

/** From the notice's click: the browser asks to share the tab only within one. */
const allowFromNotice = async () => {
  props.collector.dismissCaptureNotice()
  try {
    await props.collector.startCapture()
  } catch (e) {
    if ((e as Error).name !== 'NotAllowedError') captureError.value = `No real screenshots: ${(e as Error).message}`
  }
}

const send = (text: string, image: RelayChatImageLike) => flow.send(text, image)

const onKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || flow.step !== 'prompt') return
  e.preventDefault()
  e.stopPropagation()
  flow.cancel()
}
onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true)
  stopListening()
})

defineExpose({
  /** The 📷 click. */
  start: () => flow.start(),
  busy: computed(() => step.value !== 'idle'),
})
</script>

<template>
  <Teleport to="body">
    <div class="qd-debug" style="display: contents">
      <!-- No closing on a click outside: the prompt stays until the tab is shared, or Continue without / × is clicked. -->
      <div v-if="step === 'prompt'" class="shot-backdrop">
        <div class="shot-card" role="dialog" aria-label="Real screenshots">
          <button type="button" class="shot-close" title="No screenshot" aria-label="No screenshot" @click="flow.cancel()">
            <i class="pi pi-times" />
          </button>
          <p class="shot-title"><i class="pi pi-camera" /> Screenshot</p>
          <p class="shot-text">{{ CAPTURE_PROMPT }}</p>
          <p v-if="waiting" class="shot-text shot-wait"><i class="pi pi-spin pi-spinner" /> Waiting for the browser: share this tab.</p>
          <p v-else-if="promptNote" class="shot-text shot-warn">{{ promptNote }}</p>
          <div class="shot-actions">
            <button type="button" class="shot-btn" @click="flow.continueWithout()">Continue without</button>
            <button type="button" class="shot-btn shot-primary" :disabled="waiting" @click="flow.allow()">
              <i class="pi pi-video" /> Allow real screenshots
            </button>
          </div>
        </div>
      </div>

      <ScreenshotAnnotator v-if="step === 'annotate' && shot" :shot="shot" @send="send" @cancel="flow.cancel()" />

      <div v-if="notice" class="shot-card shot-corner" role="status" aria-label="Real screenshots">
        <button type="button" class="shot-close" title="Close" aria-label="Close" @click="collector.dismissCaptureNotice()">
          <i class="pi pi-times" />
        </button>
        <p class="shot-title"><i class="pi pi-camera" /> An agent took a screenshot</p>
        <p class="shot-text">{{ CAPTURE_PROMPT }}</p>
        <div class="shot-actions">
          <button type="button" class="shot-btn" @click="collector.declineCapture()">Continue without</button>
          <button type="button" class="shot-btn shot-primary" @click="allowFromNotice">
            <i class="pi pi-video" /> Allow real screenshots
          </button>
        </div>
      </div>
      <div v-else-if="error" class="shot-card shot-corner" role="alert">
        <button type="button" class="shot-close" title="Close" aria-label="Close" @click="dismissError">
          <i class="pi pi-times" />
        </button>
        <p class="shot-text shot-warn">{{ error }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.shot-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}
.shot-card {
  position: relative;
  max-width: 26rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #1f2937;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  color: #e5e7eb;
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.shot-corner {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2147483600;
  max-width: min(24rem, calc(100vw - 2rem));
}
.shot-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 1.5rem 0.4rem 0;
  font-weight: 600;
}
.shot-text {
  margin: 0;
}
.shot-warn,
.shot-wait {
  margin-top: 0.5rem;
  margin-right: 1.5rem;
  color: #fbbf24;
}
.shot-wait {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #93c5fd;
}
.shot-btn:disabled {
  cursor: default;
  opacity: 0.55;
}
.shot-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
  margin-top: 0.75rem;
}
.shot-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.shot-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}
.shot-primary {
  border-color: transparent;
  background: #2563eb;
  color: #fff;
}
.shot-primary:hover {
  background: #1d4ed8;
}
.shot-close {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  padding: 0.2rem 0.35rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}
.shot-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.shot-btn:focus-visible,
.shot-close:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}
</style>
