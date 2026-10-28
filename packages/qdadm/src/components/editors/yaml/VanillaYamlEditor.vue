<script setup lang="ts">
/**
 * VanillaYamlEditor - a YAML text with text, tree and form views (#4303)
 *
 * Wraps @quazardous/vanilla-yamleditor (an optional peer): CodeMirror text,
 * a technical tree, and a form generated from a JSON Schema, whose edits keep
 * the file's comments and formatting. v-model is the YAML text. The default
 * view is the lib's: form with a schema, tree without.
 *
 * <VanillaYamlEditor v-model="yaml" :schema="schema" :problems="serverProblems" />
 *
 * Schema titles and descriptions go through the catalogue, so they can be
 * i18n keys; the editor's own texts are core.yamlEditor.*.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createYamlEditor,
  type JsonSchema,
  type ParsedYaml,
  type YamlEditor,
  type YamlEditorMode,
  type YamlEditorStatus,
  type YamlProblemInput,
} from '@quazardous/vanilla-yamleditor'
import '@quazardous/vanilla-yamleditor/styles.css'
import { useI18n } from '../../../i18n/useI18n'

interface Props {
  modelValue?: string
  mode?: YamlEditorMode
  /** The views offered, in the order of their buttons (default all three). */
  modes?: YamlEditorMode[]
  /** Show the view buttons (the bar keeps its status). */
  modeSwitch?: boolean
  schema?: JsonSchema
  validator?: (value: unknown, parsed: ParsedYaml) => YamlProblemInput[]
  /** Problems found elsewhere (a server check), shown on their line and field. */
  problems?: YamlProblemInput[]
  /** Warn on valid YAML that is likely a typo (`key ::`). */
  lint?: boolean
  readOnly?: boolean
  mainMenuBar?: boolean
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  mode: undefined,
  modes: undefined,
  modeSwitch: true,
  schema: undefined,
  validator: undefined,
  problems: () => [],
  lint: true,
  readOnly: false,
  mainMenuBar: true,
  height: '400px',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:mode': [mode: YamlEditorMode]
  /** After each change: the parsed value, syntax errors and problems. */
  status: [status: YamlEditorStatus]
}>()

const { tOr, locale } = useI18n()
const container = ref<HTMLDivElement | null>(null)
let editor: YamlEditor | null = null
// The text this component last sent up, so its echo is not written back
let emitted: string | null = null

function labels() {
  const n = (key: string, one: string, many: string) => (count: number) => tOr(`core.yamlEditor.${key}`, `${one} | ${many}`, { count })
  return {
    text: tOr('core.yamlEditor.text', 'Text'),
    tree: tOr('core.yamlEditor.tree', 'Tree'),
    form: tOr('core.yamlEditor.form', 'Form'),
    modes: tOr('core.yamlEditor.modes', 'View'),
    syntaxBlocked: tOr('core.yamlEditor.syntaxBlocked', 'Fix the syntax errors before switching to the tree or the form'),
    syntaxErrors: n('syntaxErrors', '{count} syntax error', '{count} syntax errors'),
    warnings: n('warnings', '{count} warning', '{count} warnings'),
    colonKey: (key: string, suggestion: string) => tOr('core.yamlEditor.colonKey', 'The key is "{key}": did you mean "{suggestion}:"?', { key, suggestion }),
    spacedKey: (key: string) => tOr('core.yamlEditor.spacedKey', 'The key "{key}" starts or ends with a space', { key }),
    addItem: tOr('core.yamlEditor.addItem', 'Add item'),
    addKey: tOr('core.yamlEditor.addKey', 'Add'),
    newKey: tOr('core.yamlEditor.newKey', 'new key'),
    remove: tOr('core.yamlEditor.remove', 'Remove'),
    rename: tOr('core.yamlEditor.rename', 'Key name'),
    empty: tOr('core.yamlEditor.empty', '(empty)'),
    alias: tOr('core.yamlEditor.alias', 'An alias, edit it in the text view'),
    count: n('count', '{count} entry', '{count} entries'),
  }
}

/** A schema title or description: an i18n key when the catalogue has it, else the text itself. */
const translate = (text: string) => tOr(text, text)

onMounted(() => {
  if (!container.value) return
  editor = createYamlEditor({
    target: container.value,
    props: {
      content: props.modelValue,
      mode: props.mode,
      modes: props.modes,
      modeSwitch: props.modeSwitch,
      schema: props.schema,
      validator: props.validator,
      problems: props.problems,
      lint: props.lint,
      readOnly: props.readOnly,
      mainMenuBar: props.mainMenuBar,
      labels: labels(),
      translate,
      onChange: (text, status) => {
        emitted = text
        emit('update:modelValue', text)
        emit('status', status)
      },
      onChangeMode: (mode) => emit('update:mode', mode),
    },
  })
  emit('status', editor.status())
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || value === emitted || value === editor.get()) return
    editor.update(value ?? '')
    emit('status', editor.status())
  }
)
watch(
  () => [props.schema, props.validator, props.problems, props.lint, props.readOnly, props.mainMenuBar, props.modes, props.modeSwitch] as const,
  () => {
    editor?.updateProps({ schema: props.schema, validator: props.validator, problems: props.problems, lint: props.lint, readOnly: props.readOnly, mainMenuBar: props.mainMenuBar, modes: props.modes, modeSwitch: props.modeSwitch })
    if (editor) emit('status', editor.status())
  }
)
watch(locale, () => editor?.updateProps({ labels: labels() }))
watch(
  () => props.mode,
  (mode) => mode && editor?.setMode(mode)
)

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})

defineExpose({
  /** The underlying vanilla-yamleditor instance. */
  editor: () => editor,
  revealPath: (path: (string | number)[]) => editor?.revealPath(path),
  focus: () => editor?.focus(),
})
</script>

<template>
  <div ref="container" class="qd-yaml-editor" :style="{ height }"></div>
</template>
