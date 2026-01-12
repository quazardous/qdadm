<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'

type SizeVariant = 'sm' | 'md' | 'lg'
type Severity = 'success' | 'warning' | 'danger'

interface ApiAdapter {
  request: (method: string, endpoint: string) => Promise<Record<string, unknown>>
}

interface BarProps {
  percentage: number
  tier: number
  color: string
  severity: Severity
  threshold: number
}

const props = defineProps({
  value: {
    type: Number,
    required: true
  },
  showValue: {
    type: Boolean,
    default: true
  },
  size: {
    type: String as () => SizeVariant,
    default: 'md', // sm, md, lg
    validator: (v: string) => ['sm', 'md', 'lg'].includes(v)
  },
  // Threshold configuration
  threshold: {
    type: Number as () => number | null,
    default: null // If provided, use static threshold instead of loading from API
  },
  configEndpoint: {
    type: String as () => string | null,
    default: null // Endpoint to load threshold config from API
  },
  configThresholdKey: {
    type: String,
    default: 'threshold' // Key in config response containing threshold value
  }
})

// Get API adapter (optional - only needed if loading from endpoint)
const api = inject<ApiAdapter | null>('apiAdapter', null)

// Threshold value
const loadedThreshold = ref<number>(8) // default fallback
const configLoaded = ref<boolean>(false)

// Computed threshold - use prop if provided, otherwise loaded value
const currentThreshold = computed<number>(() => props.threshold ?? loadedThreshold.value)

// Singleton pattern - load config once for all instances
let configPromise: Promise<void> | null = null

async function loadConfig(): Promise<void> {
  // Skip if using static threshold or no endpoint configured
  if (props.threshold !== null || !props.configEndpoint) {
    configLoaded.value = true
    return
  }

  // Skip if no API adapter
  if (!api) {
    console.warn('[IntensityBar] apiAdapter not provided, using default threshold')
    configLoaded.value = true
    return
  }

  if (configPromise) return configPromise

  configPromise = api.request('GET', props.configEndpoint)
    .then((data: Record<string, unknown>) => {
      if (data?.[props.configThresholdKey]) {
        loadedThreshold.value = data[props.configThresholdKey] as number
      }
      configLoaded.value = true
    })
    .catch(() => {
      console.warn('[IntensityBar] Could not load config, using defaults')
      configLoaded.value = true
    })

  return configPromise
}

// Calculate bar properties based on threshold tiers
const barProps = computed<BarProps>(() => {
  const threshold = currentThreshold.value
  const tier = Math.floor(props.value / threshold)
  const withinTier = props.value % threshold
  const percentage = (withinTier / threshold) * 100

  // Color: green (tier 0), orange (tier 1), red (tier 2+)
  let color = 'var(--p-green-500)'
  let severity: Severity = 'success'
  if (tier === 1) {
    color = 'var(--p-orange-500)'
    severity = 'warning'
  } else if (tier >= 2) {
    color = 'var(--p-red-500)'
    severity = 'danger'
  }

  return { percentage, tier, color, severity, threshold }
})

// Size classes
const sizeClass = computed<string>(() => `intensity-bar--${props.size}`)

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="intensity-container" :class="sizeClass">
    <div
      class="intensity-bar"
      :style="{ '--bar-color': barProps.color, '--bar-width': barProps.percentage + '%' }"
      :title="`Tier ${barProps.tier} (threshold: ${barProps.threshold})`"
    >
      <div class="intensity-bar-fill"></div>
    </div>
    <span v-if="showValue" class="intensity-value" :style="{ color: barProps.color }">
      {{ value.toFixed(2) }}
    </span>
  </div>
</template>

<style scoped>
.intensity-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.intensity-bar {
  background: var(--p-surface-200);
  border-radius: 4px;
  overflow: hidden;
  /* Default size (md) */
  width: 80px;
  height: 8px;
}

.intensity-bar--sm .intensity-bar {
  width: 60px;
  height: 6px;
}

.intensity-bar--lg .intensity-bar {
  width: 120px;
  height: 10px;
}

.intensity-bar-fill {
  height: 100%;
  width: var(--bar-width);
  background: var(--bar-color);
  border-radius: 4px;
  transition: width 0.3s ease, background 0.3s ease;
}

.intensity-value {
  font-weight: 600;
  min-width: 45px;
}

.intensity-bar--sm .intensity-value {
  font-size: 0.8em;
}

.intensity-bar--md .intensity-value {
  font-size: 0.9em;
}

.intensity-bar--lg .intensity-value {
  font-size: 1em;
}
</style>
