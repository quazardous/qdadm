<script setup lang="ts">
/**
 * /email surface (#4113): parseMime must type as an EmailParser, so it plugs
 * into EmailPreview's `parser` prop. postal-mime is declared here because it
 * is an optional peer, as vanilla-jsoneditor is for /editors.
 */
import { EmailPreview, fromMailpit, type EmailParser, type ParsedEmail } from '@quazardous/qdadm'
import { parseMime } from '@quazardous/qdadm/email'

const parser: EmailParser = parseMime
const parsed: ParsedEmail = fromMailpit({ ID: 'x', Subject: 'Hi', HTML: '<p>x</p>' })
</script>

<template>
  <EmailPreview :raw="'Subject: x\r\n\r\nbody'" :parser="parser" />
  <EmailPreview :email="parsed" load-images />
</template>
