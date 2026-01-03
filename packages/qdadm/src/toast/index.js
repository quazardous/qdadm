/**
 * Toast Module - Signal-based toast notifications
 *
 * Provides toast notifications that go through the signal bus,
 * allowing for proper debugging and interception.
 *
 * Components:
 * - ToastBridgeModule: Registers ToastListener for handling signals
 * - ToastListener: Vue component that displays toasts via PrimeVue
 * - useSignalToast: Composable for emitting toast signals
 */

export { ToastBridgeModule, TOAST_ZONE } from './ToastBridgeModule.js'
export { useSignalToast } from './useSignalToast.js'
export { default as ToastListener } from './ToastListener.vue'
