<script setup lang="ts">
/**
 * The screenshot the user annotates before sending it to the agent (#2309): a pen, colours, undo, a note.
 *
 * Teleported to <body> inside its own `.qd-debug` root: it covers the whole page, and every page tool still treats
 * it as the debug bar — never in a screenshot, never in page_snapshot.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Annotation, PEN_COLORS, drawStrokes, toPicture } from './annotation'
import type { RelayChatImageLike, RelayShotLike } from '../../collectors/RelayCollector'

const props = defineProps<{ shot: RelayShotLike }>()
const emit = defineEmits<{ send: [text: string, image: RelayChatImageLike]; cancel: [] }>()

const model = new Annotation(props.shot.width, props.shot.height)
const version = ref(0)
const color = ref<string>(model.color)
const note = ref('')
const canvas = ref<HTMLCanvasElement | null>(null)
const hasStrokes = computed(() => {
  void version.value
  return !model.empty
})

const picture = new Image()
let pictureReady = false

function redraw(): void {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  ctx.clearRect(0, 0, c.width, c.height)
  if (pictureReady) ctx.drawImage(picture, 0, 0, c.width, c.height)
  drawStrokes(ctx, model.strokes)
}
const changed = () => {
  version.value++
  redraw()
}

watch(color, (value) => {
  model.color = value
})

let drawing = false
const at = (e: PointerEvent) =>
  toPicture(e.clientX, e.clientY, canvas.value!.getBoundingClientRect(), props.shot.width, props.shot.height)
const onDown = (e: PointerEvent) => {
  if (e.button !== 0 || !canvas.value) return
  drawing = true
  try {
    // Keeps the stroke going when the pointer leaves the picture. A pointer the browser does not track refuses it.
    canvas.value.setPointerCapture?.(e.pointerId)
  } catch {
    /* draw without capture */
  }
  model.begin(at(e))
  changed()
}
const onMove = (e: PointerEvent) => {
  if (!drawing) return
  model.extend(at(e))
  changed()
}
const onUp = () => {
  if (!drawing) return
  drawing = false
  model.end()
  changed()
}
const undo = () => {
  model.undo()
  changed()
}
const clear = () => {
  model.clear()
  changed()
}

const send = () => {
  const c = canvas.value
  if (!c) return
  redraw()
  const url = c.toDataURL('image/jpeg', 0.85)
  emit('send', note.value.trim(), { mimeType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) })
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('cancel')
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    e.stopPropagation()
    undo()
  }
}

onMounted(() => {
  picture.onload = () => {
    pictureReady = true
    redraw()
  }
  picture.src = `data:${props.shot.mimeType};base64,${props.shot.data}`
  window.addEventListener('keydown', onKey, true)
})
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <div class="qd-debug" style="display: contents">
      <div class="mcp-annotator" role="dialog" aria-label="Annotate the screenshot">
        <div class="mcp-annotator-tools">
          <span class="mcp-annotator-label"><i class="pi pi-pencil" /> Pen</span>
          <button
            v-for="c in PEN_COLORS"
            :key="c.value"
            type="button"
            class="mcp-annotator-swatch"
            :class="{ 'mcp-annotator-swatch-active': color === c.value }"
            :style="{ background: c.value }"
            :title="c.name"
            :aria-label="`${c.name} pen`"
            :aria-pressed="color === c.value"
            @click="color = c.value"
          />
          <button type="button" class="mcp-annotator-btn" :disabled="!hasStrokes" @click="undo"><i class="pi pi-undo" /> Undo</button>
          <button type="button" class="mcp-annotator-btn" :disabled="!hasStrokes" @click="clear"><i class="pi pi-times" /> Clear</button>
          <form class="mcp-annotator-send" @submit.prevent="send">
            <input v-model="note" class="mcp-annotator-note" maxlength="2000" placeholder="Add a note (optional)…" @keydown.stop />
            <button type="button" class="mcp-annotator-btn" @click="emit('cancel')">Cancel</button>
            <button type="submit" class="mcp-annotator-btn mcp-annotator-primary"><i class="pi pi-send" /> Send</button>
          </form>
        </div>
        <div class="mcp-annotator-stage">
          <canvas
            ref="canvas"
            :width="shot.width"
            :height="shot.height"
            class="mcp-annotator-canvas"
            aria-label="Screenshot: draw on it to circle what you mean"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mcp-annotator {
  position: fixed;
  inset: 0;
  z-index: 2147483600;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.82);
  color: #e5e7eb;
  font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.mcp-annotator-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #1f2937;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.mcp-annotator-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}
.mcp-annotator-swatch {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  cursor: pointer;
}
.mcp-annotator-swatch-active {
  border-color: #fff;
  box-shadow: 0 0 0 2px #2563eb;
}
.mcp-annotator-btn {
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
.mcp-annotator-btn:disabled {
  cursor: default;
  opacity: 0.45;
}
.mcp-annotator-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
}
.mcp-annotator-primary {
  border-color: transparent;
  background: #2563eb;
  color: #fff;
}
.mcp-annotator-primary:hover:not(:disabled) {
  background: #1d4ed8;
}
.mcp-annotator-send {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
  min-width: 16rem;
}
.mcp-annotator-note {
  flex: 1;
  min-width: 10rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  font: inherit;
}
.mcp-annotator-swatch:focus-visible,
.mcp-annotator-btn:focus-visible,
.mcp-annotator-note:focus {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}
.mcp-annotator-stage {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0.75rem;
}
.mcp-annotator-canvas {
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25), 0 8px 30px rgba(0, 0, 0, 0.5);
  cursor: crosshair;
  touch-action: none;
}
</style>
