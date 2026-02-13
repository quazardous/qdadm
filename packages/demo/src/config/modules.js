/**
 * Module definitions for demo app
 *
 * Module System v2 - Class-based modules
 * Note: ToastBridgeModule is auto-injected by Kernel, don't add it here
 */

import { SecurityModule } from 'qdadm/security'
import { BooksModule } from '../modules/books/BooksModule'
import { UsersModule } from '../modules/users/UsersModule'
import { LoansModule } from '../modules/loans/LoansModule'
import { CountriesModule } from '../modules/countries/CountriesModule'
import { ProductsModule } from '../modules/products/ProductsModule'
import { SettingsModule } from '../modules/settings/SettingsModule'
import { FavoritesModule } from '../modules/favorites/FavoritesModule'
import { JsonPlaceholderModule } from '../modules/jsonplaceholder/JsonPlaceholderModule'

export const moduleDefs = [
  SecurityModule,
  BooksModule,
  UsersModule,
  LoansModule,
  CountriesModule,
  ProductsModule,
  SettingsModule,
  FavoritesModule,
  JsonPlaceholderModule
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
  'Security'
]
