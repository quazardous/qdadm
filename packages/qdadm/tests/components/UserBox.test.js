/**
 * Sidebar user box (#4157): `app.userRoute` turns the name and avatar into a
 * profile link and leaves logout to the glyph; `app.userAvatar` (or
 * `user.avatar` / `user.avatarUrl`) shows a picture, with the initials as
 * fallback.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AppLayout from '../../src/components/layout/AppLayout.vue'
import DefaultUserInfo from '../../src/components/layout/defaults/DefaultUserInfo.vue'
import { resolveUserAvatar, isExternalUserLink } from '../../src/composables/useUserBox'

const push = vi.fn()
const logout = vi.fn()
const userRef = ref(null)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ path: '/books', name: 'books', params: {}, query: {} }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a class="router-link" :data-to="JSON.stringify(to)"><slot /></a>',
  },
  RouterView: { name: 'RouterView', template: '<div class="router-view" />' },
}))

vi.mock('../../src/composables/useNavigation', () => ({
  useNavigation: () => ({
    navSections: ref([]),
    isNavActive: () => false,
    sectionHasActiveItem: () => false,
    handleNavClick: vi.fn(),
  }),
}))

vi.mock('../../src/composables/useNavContext', () => ({
  useNavContext: () => ({ breadcrumb: ref([]), navlinks: ref([]), modeLinks: ref([]) }),
}))

vi.mock('../../src/composables/useApp', () => ({
  useApp: () => ({ name: 'Test', shortName: 'T', version: '0.0.0', logo: null }),
}))

vi.mock('../../src/composables/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: ref(true), user: userRef, logout, authEnabled: true }),
}))

vi.mock('../../src/composables/useGuardStore', async (importOriginal) => ({
  ...(await importOriginal()),
  useGuardDialog: () => null,
}))

vi.mock('primevue/breadcrumb', () => ({
  default: { name: 'Breadcrumb', props: ['model'], template: '<nav />' },
}))

function mountWith(component, app = {}) {
  return mount(component, {
    global: {
      provide: { qdadmApp: app, qdadmFeatures: { poweredBy: false } },
      directives: { tooltip: {} },
      stubs: { UnsavedChangesDialog: true, Zone: true, TaskTray: true, TaskHost: true },
    },
  })
}

beforeEach(() => {
  push.mockReset()
  logout.mockReset()
  userRef.value = { username: 'ana', email: 'ana@example.test' }
})

describe('resolveUserAvatar (#4157)', () => {
  it('reads user.avatar, then user.avatarUrl', () => {
    expect(resolveUserAvatar({ avatar: '/a.png', avatarUrl: '/b.png' })).toBe('/a.png')
    expect(resolveUserAvatar({ avatarUrl: '/b.png' })).toBe('/b.png')
    expect(resolveUserAvatar({ username: 'x' })).toBe(null)
    expect(resolveUserAvatar(null)).toBe(null)
  })

  it('lets the app resolver decide, and falls back to initials when it gives nothing or throws', () => {
    expect(resolveUserAvatar({ id: 7, avatar: '/a.png' }, (u) => `/avatars/${u.id}.jpg`)).toBe('/avatars/7.jpg')
    expect(resolveUserAvatar({ avatar: '/a.png' }, () => null)).toBe(null)
    expect(resolveUserAvatar({}, () => '  ')).toBe(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveUserAvatar({}, () => { throw new Error('no') })).toBe(null)
    warn.mockRestore()
  })
})

describe('isExternalUserLink (#4157)', () => {
  it('tells an absolute URL from a route', () => {
    for (const url of ['https://id.test/account', 'http://x.test', '//id.test/me', 'mailto:me@x.test']) expect(isExternalUserLink(url)).toBe(true)
    for (const route of ['profile', 'admin:profile', '/profile', { name: 'profile' }]) expect(isExternalUserLink(route)).toBe(false)
  })
})

describe('AppLayout user box (#4157)', () => {
  it('without userRoute, the whole box still logs out', async () => {
    const wrapper = mountWith(AppLayout)
    const box = wrapper.find('#user-zone')
    expect(box.find('.user-zone-link').exists()).toBe(false)
    expect(box.find('.user-avatar').text()).toBe('AN')
    await box.trigger('click')
    expect(logout).toHaveBeenCalledOnce()
  })

  it('with userRoute, name and avatar link to the profile and only the glyph logs out', async () => {
    const wrapper = mountWith(AppLayout, { userRoute: { name: 'profile' } })
    const box = wrapper.find('#user-zone')
    const link = box.find('a.user-zone-link')
    expect(JSON.parse(link.attributes('data-to'))).toEqual({ name: 'profile' })
    expect(link.find('.user-avatar').text()).toBe('AN')
    expect(link.attributes('aria-label')).toBe('ana — My profile')

    await box.trigger('click')
    await link.trigger('click')
    expect(logout).not.toHaveBeenCalled()

    const glyph = box.find('button.user-zone-logout')
    expect(glyph.attributes('aria-label')).toBe('Logout')
    await glyph.trigger('click')
    expect(logout).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('reads a bare string as a route name, and a string starting with / as a path', () => {
    const named = mountWith(AppLayout, { userRoute: 'profile' }).find('#user-zone a.user-zone-link')
    expect(JSON.parse(named.attributes('data-to'))).toEqual({ name: 'profile' })
    const path = mountWith(AppLayout, { userRoute: '/me/profile' }).find('#user-zone a.user-zone-link')
    expect(JSON.parse(path.attributes('data-to'))).toBe('/me/profile')
  })

  it('with an external userRoute, links out in a new tab', async () => {
    const wrapper = mountWith(AppLayout, { userRoute: 'https://id.test/account' })
    const link = wrapper.find('#user-zone a.user-zone-link')
    expect(link.classes()).not.toContain('router-link')
    expect(link.attributes('href')).toBe('https://id.test/account')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.find('#user-zone button.user-zone-logout').exists()).toBe(true)
  })

  it('shows the avatar picture, and the initials again when it fails to load', async () => {
    userRef.value = { username: 'ana', avatarUrl: 'https://cdn.test/ana.png' }
    const wrapper = mountWith(AppLayout, { userRoute: 'profile' })
    const img = wrapper.find('#user-zone img.user-avatar')
    expect(img.attributes('src')).toBe('https://cdn.test/ana.png')
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('referrerpolicy')).toBe('no-referrer')

    await img.trigger('error')
    expect(wrapper.find('#user-zone img').exists()).toBe(false)
    expect(wrapper.find('#user-zone .user-avatar').text()).toBe('AN')

    // A new picture gets its own chance
    userRef.value = { username: 'ana', avatarUrl: 'https://cdn.test/ana-2.png' }
    await nextTick()
    expect(wrapper.find('#user-zone img').attributes('src')).toBe('https://cdn.test/ana-2.png')
  })

  it('uses app.userAvatar over the user fields', () => {
    userRef.value = { id: 3, username: 'ana', avatar: '/ignored.png' }
    const wrapper = mountWith(AppLayout, { userAvatar: (u) => `/avatars/${u.id}.jpg` })
    expect(wrapper.find('#user-zone img').attributes('src')).toBe('/avatars/3.jpg')
  })
})

describe('DefaultUserInfo (#4157)', () => {
  it('links avatar and name to the profile when userRoute is set', () => {
    userRef.value = { username: 'ana', avatar: '/ana.png' }
    const wrapper = mountWith(DefaultUserInfo, { userRoute: 'profile' })
    const link = wrapper.find('a.user-identity')
    expect(JSON.parse(link.attributes('data-to'))).toEqual({ name: 'profile' })
    expect(link.find('img').attributes('src')).toBe('/ana.png')
    expect(link.find('.user-name').text()).toBe('ana')
  })

  it('links out for an external userRoute', () => {
    const wrapper = mountWith(DefaultUserInfo, { userRoute: 'https://id.test/account' })
    const link = wrapper.find('a.user-identity')
    expect(link.attributes('href')).toBe('https://id.test/account')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('stays a plain block without userRoute', () => {
    const wrapper = mountWith(DefaultUserInfo)
    expect(wrapper.find('a.user-identity').exists()).toBe(false)
    expect(wrapper.find('div.user-identity .user-avatar').text()).toBe('AN')
  })
})
