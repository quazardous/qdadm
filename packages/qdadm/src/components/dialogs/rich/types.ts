/**
 * The rich dialog (#5445): a generic modal with no business meaning. What's
 * new, a licence or a charter are only uses of it.
 */
import type { Component } from 'vue'
import type { ButtonSeverity } from '../../../types'

/** One block of content, drawn by the content handler its `kind` names */
export interface RichDialogBlock {
  /** `text`, `markdown`, `html`, or a kind the app registered */
  kind: string
  title?: string
  /** A small line under the title: a date, a version */
  meta?: string
  /** The handler's own fields: `text` for text, `source` for markdown and html… */
  [field: string]: unknown
}

/** A button of the action area */
export interface RichDialogAction {
  key: string
  label: string
  icon?: string
  severity?: ButtonSeverity
  /** Closes the dialog (default true) */
  closes?: boolean
  /** Disabled until the dialog is ready: read to the end (with `readToEnd`) and its required controls filled */
  requiresRead?: boolean
}

/** A control of the action area, drawn by the control handler its `kind` names */
export interface RichDialogControl {
  /** Its value's name in the result's `values` */
  key: string
  /** `toggle` (default), `checkbox`, or a kind the app registered */
  kind?: string
  label?: string
  /** Its starting value */
  value?: unknown
  /** Empty (undefined, null, '', false, []): the `requiresRead` actions stay disabled */
  required?: boolean
  /** The handler's own options */
  [option: string]: unknown
}

/** What the dialog answers: the action chosen (null when dismissed) and the controls' values */
export interface RichDialogResult {
  action: string | null
  values: Record<string, unknown>
}

/** What the app's own footer receives */
export interface RichDialogFooterProps {
  /** Scrolled to the end, or nothing to scroll */
  read: boolean
  /** Read (with `readToEnd`) and the required controls filled */
  ready: boolean
  /** The controls' values; the app's own controls write into it */
  values: Record<string, unknown>
  /** Close, answering with this action (and values merged from `extra`) */
  resolve: (action: string, extra?: Record<string, unknown>) => void
  /** Dismiss */
  close: () => void
}

/** What `useRichDialog().open()` takes */
export interface RichDialogOptions {
  title: string
  icon?: string
  /** Default 40rem */
  width?: string
  /** The scrolling area's height at most (default 60vh) */
  maxHeight?: string
  blocks: RichDialogBlock[]
  actions?: RichDialogAction[]
  controls?: RichDialogControl[]
  /** The `requiresRead` actions wait until the content was scrolled to its end */
  readToEnd?: boolean
  /** Escape and × close it (default true); false for a licence */
  dismissable?: boolean
  /** The app's own footer, in place of the declared buttons and controls */
  footer?: Component
}
