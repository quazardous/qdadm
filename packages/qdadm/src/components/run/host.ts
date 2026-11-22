import type { InjectionKey } from 'vue'

/** Provided by a layout that draws the run bar at its foot (#5453): the pages' own bar then draws nothing */
export const RUN_BAR_HOST: InjectionKey<boolean> = Symbol('qdadm.runBarHost')
