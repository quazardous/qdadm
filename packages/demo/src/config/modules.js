/**
 * Module definitions for demo app
 *
 * Module System v2 - Class-based modules
 * Note: ToastBridgeModule is auto-injected by Kernel, don't add it here
 */

import { SecurityModule } from '@quazardous/qdadm/security'
import { BooksModule } from '../modules/books/BooksModule'
import { UsersModule } from '../modules/users/UsersModule'
import { LoansModule } from '../modules/loans/LoansModule'
import { CountriesModule } from '../modules/countries/CountriesModule'
import { ProductsModule } from '../modules/products/ProductsModule'
import { SettingsModule } from '../modules/settings/SettingsModule'
import { FavoritesModule } from '../modules/favorites/FavoritesModule'
import { JsonPlaceholderModule } from '../modules/jsonplaceholder/JsonPlaceholderModule'
import { NotificationsDemoModule } from '../modules/notifications/NotificationsDemoModule'
import { OpsDemoModule } from '../modules/ops/OpsDemoModule'
import { SessionsModule } from '@quazardous/qdadm'
import { fakeSessionsAdapter } from '../modules/ops/fakeSessions'

export const moduleDefs = [
  SecurityModule,
  BooksModule,
  UsersModule,
  LoansModule,
  CountriesModule,
  ProductsModule,
  SettingsModule,
  FavoritesModule,
  JsonPlaceholderModule,
  NotificationsDemoModule,
  OpsDemoModule,
  // Who else is here, and the sign-in history (#4336), over a fake server
  new SessionsModule({
    adapter: fakeSessionsAdapter,
    permission: 'admin:sessions',
    bannerSeverity: 'warn',
    nav: { section: 'Security' },
  })
]

export const modulesOptions = {
  coreNavItems: [
    { section: 'Library', route: 'home', icon: 'pi pi-home', label: 'Home' }
  ]
}

export const sectionOrder = [
  'Library',
  'Memory Storage',
  'Local Storage',
  'JSONPlaceholder',
  'DummyJSON',
  'REST Countries',
  'Security',
  'Features'
]
