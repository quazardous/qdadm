<script setup lang="ts">
/**
 * QdSettingsHome (#5500): qdadm's own settings home, `settingsMenu.home: true`.
 * The settings menu's entries as cards, one group per section, each entry
 * shown to whoever the menu shows it to. The root of every settings page's
 * breadcrumb.
 */
import { RouterLink } from 'vue-router'
import PageLayout from '../layout/PageLayout.vue'
import { useNavigation } from '../../composables/useNavigation'
import { useI18n } from '../../i18n/useI18n'

const nav = useNavigation()
const { tOr } = useI18n()
const sections = nav.settingsSections
const flat = nav.settingsMenu.flat
</script>

<template>
  <PageLayout :title="nav.settingsMenu.label">
    <div class="qd-settings-home" data-settings-home-page>
      <p v-if="!sections.length" class="qd-settings-home-empty">{{ tOr('core.settingsMenu.empty', 'Nothing to set here.') }}</p>
      <section v-for="section in sections" :key="section.title || section.label" class="qd-settings-home-section">
        <h2 v-if="!flat && section.title" class="qd-settings-home-title">{{ section.title }}</h2>
        <div class="qd-settings-home-grid">
          <template v-for="item in section.items" :key="item.route ?? item.href">
            <a v-if="item.href" :href="item.href" :target="item.target" :rel="item.rel" class="qd-settings-home-card">
              <i :class="item.icon || 'pi pi-external-link'" aria-hidden="true"></i>
              <span>{{ item.label }}</span>
            </a>
            <RouterLink v-else :to="{ name: item.route }" class="qd-settings-home-card" @click="nav.handleNavClick($event, item)">
              <i :class="item.icon || 'pi pi-cog'" aria-hidden="true"></i>
              <span>{{ item.label }}</span>
            </RouterLink>
          </template>
        </div>
      </section>
    </div>
  </PageLayout>
</template>
