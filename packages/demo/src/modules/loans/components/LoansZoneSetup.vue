<script setup>
/**
 * LoansZoneSetup - Registers Loans module zone extensions
 *
 * CROSS-MODULE ZONE EXTENSION DEMO
 * =================================
 * This component demonstrates the Drupal-inspired extensibility pattern where
 * one module (Loans) extends zones defined by another module (Books) without
 * modifying the original module's code.
 *
 * Three operations are demonstrated:
 *
 * 1. REPLACE - Completely substitute a block
 *    Loans replaces 'books-header' with LoanAwareBooksHeader that shows
 *    loan statistics alongside the original header content.
 *
 * 2. EXTEND - Insert content before/after a block
 *    Loans adds LoanStatusColumn after 'books-header' to show overdue
 *    loan warnings without touching the header itself.
 *
 * 3. WRAP - Decorate a block with wrapper content
 *    Loans wraps 'books-detail' with AvailabilityWrapper that shows
 *    loan availability status around the book detail content.
 *
 * REGISTRATION ORDER
 * ==================
 * Zone extensions are registered with higher weights (60, 70, 80) than the
 * original blocks (50) to ensure predictable ordering. The ZoneRegistry
 * processes operations in order:
 * 1. Replace operations substitute target blocks
 * 2. Extend operations insert relative to targets
 * 3. Wrap operations build decorator chains
 */
import { onMounted } from 'vue'
import { useZoneRegistry } from 'qdadm'
import LoanAwareBooksHeader from './LoanAwareBooksHeader.vue'
import LoanStatusColumn from './LoanStatusColumn.vue'
import AvailabilityWrapper from './AvailabilityWrapper.vue'

const { registerBlock } = useZoneRegistry()

onMounted(() => {
  // ============================================================
  // REPLACE: Substitute Books header with loan-aware version
  // ============================================================
  // This completely replaces the BooksListHeader component with
  // LoanAwareBooksHeader, which shows the same content plus loan stats.
  registerBlock('books-list-header', {
    id: 'loans-header-replacement',
    component: LoanAwareBooksHeader,
    weight: 60,
    operation: 'replace',
    replaces: 'books-header'
  })

  // ============================================================
  // EXTEND: Add overdue warning after header
  // ============================================================
  // This inserts LoanStatusColumn AFTER the header (or its replacement).
  // Shows overdue loan warnings below the header area.
  registerBlock('books-list-header', {
    id: 'loans-status-extension',
    component: LoanStatusColumn,
    weight: 70,
    operation: 'extend',
    after: 'loans-header-replacement'  // After the replaced header
  })

  // ============================================================
  // WRAP: Decorate book detail with availability info
  // ============================================================
  // This wraps the BooksDetailPanel with AvailabilityWrapper,
  // adding loan status banners around the original content.
  registerBlock('books-detail-content', {
    id: 'loans-availability-wrapper',
    component: AvailabilityWrapper,
    weight: 80,
    operation: 'wrap',
    wraps: 'books-detail'
  })
})
</script>

<template>
  <!-- Render-less setup component -->
</template>
