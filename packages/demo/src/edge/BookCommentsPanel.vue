<script setup>
/** The demo's contextual edge panel (#5506): the comments of the book on screen */
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import { QdButton } from '@quazardous/qdadm'
import { commentsOf } from './panels'

const props = defineProps({ bookId: { type: String, required: true } })
const list = computed(() => commentsOf(props.bookId))
const text = ref('')
function add() {
  const t = text.value.trim()
  if (!t) return
  list.value.push({ text: t, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
  text.value = ''
}
</script>

<template>
  <div class="edge-demo-comments">
    <p v-if="!list.length" class="edge-demo-empty">No comment on this book yet.</p>
    <ul v-else class="edge-demo-list">
      <li v-for="(c, i) in list" :key="i"><span class="edge-demo-at">{{ c.at }}</span> {{ c.text }}</li>
    </ul>
    <form class="edge-demo-form" @submit.prevent="add">
      <InputText v-model="text" placeholder="A comment" aria-label="A comment" data-edge-comment />
      <QdButton type="submit" label="Add" size="small" />
    </form>
  </div>
</template>

<style scoped>
.edge-demo-comments {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.edge-demo-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.edge-demo-at {
  opacity: 0.65;
  margin-right: 0.4rem;
}
.edge-demo-empty {
  margin: 0;
  opacity: 0.7;
}
.edge-demo-form {
  display: flex;
  gap: 0.5rem;
}
.edge-demo-form :deep(input) {
  flex: 1;
}
</style>
