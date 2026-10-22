<script setup>
/**
 * ProfilePage — the signed-in user, opened from the sidebar user box (#4157).
 */
import { usePageTitle, useUserBox } from '@quazardous/qdadm'
import Card from 'primevue/card'

usePageTitle('My profile')

const { user, displayName, subtitle, initials, avatarUrl, avatarFailed } = useUserBox()
</script>

<template>
  <Card class="profile-page">
    <template #content>
      <div class="profile">
        <img v-if="avatarUrl" class="avatar" :src="avatarUrl" alt="" @error="avatarFailed" />
        <span v-else class="avatar avatar--initials">{{ initials }}</span>
        <div>
          <h2 class="name">{{ displayName }}</h2>
          <p class="subtitle">{{ subtitle }}</p>
          <p class="hint">
            This page is <code>app.userRoute</code>: the name and avatar at the bottom of the sidebar open it, and only the
            glyph on their left signs out. The picture comes from <code>app.userAvatar</code>; bob's is missing on purpose,
            so his initials show.
          </p>
        </div>
      </div>
      <dl class="fields">
        <dt>Id</dt><dd>{{ user?.id }}</dd>
        <dt>Role</dt><dd>{{ user?.role }}</dd>
      </dl>
    </template>
  </Card>
</template>

<style scoped>
.profile {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.avatar--initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-600, #475569);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 600;
}
.name {
  margin: 0;
}
.subtitle {
  margin: 0.25rem 0 0.75rem;
  color: var(--p-text-muted-color);
}
.hint {
  max-width: 40rem;
  font-size: 0.875rem;
}
.fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin-top: 1rem;
}
.fields dt {
  color: var(--p-text-muted-color);
}
</style>
