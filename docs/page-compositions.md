# Page Compositions — quoi utiliser selon le besoin

> **Par où commencer.** Ce guide mappe un besoin UI → la composition qdadm à utiliser.
> Pour le détail de chaque brique (méthodes, slots, options), voir [crud.md](./crud.md).

qdadm fournit quelques **compositions canoniques**. Connaître la bonne dès le départ
évite de partir sur un `DataTable` hand-rolled là où une `ListPage` conforme suffit
(cf. [QDADM_CREDO](../packages/qdadm/QDADM_CREDO.md) — storage invisible + ListPage par défaut).

## Tableau de décision

| Je veux… | Quand | Composition | Briques | Détail |
|---|---|---|---|---|
| Lister une entité (CRUD) | Une page de liste classique avec filtres/actions | **List page** | `useListPage` + `ListPage` (+ `addCreateAction`/`addEditAction`/`addDeleteAction`) | [crud.md#list-page](./crud.md#list-page) |
| Créer / éditer une entité | Un formulaire unique create+edit | **Form page** | `useEntityItemFormPage` + `FormPage` (`#fields` requis, `FieldGroups`, `addSaveAction`) | [crud.md#form-page](./crud.md#form-page) |
| Afficher une entité en lecture | Une fiche read-only | **Show page** | `useEntityItemShowPage` + `ShowPage` + `ShowField` | [crud.md#show-page](./crud.md#show-page) |
| Lister une entité **enfant** sous un parent | Liste enfant autonome (onglet de la fiche parent) | **Child list (tab)** | `useListPage` + `ListPage` + `PageNav`, déclarée via `ctx.crud(child, {list}, {parentRoute, foreignKey})` | [crud.md#child-entity-list](./crud.md#child-entity-list) |
| **Détail parent + sa liste enfant ensemble** | Voir [Compositions hybrides](#compositions-hybrides) | **Hybride A / B2 / B1** | selon le cas | ci-dessous |
| Onglet custom (non-entité) sur une fiche | Bloc libre attaché à un parent | **Child page** | `useChildPage` + `PageLayout`, via `ctx.childPage(parent, name, opts)` | [crud.md#child-page-non-entity](./crud.md#child-page-non-entity) |
| Form avec onglets / blocs custom | Layout riche dans un formulaire | **Form + groupes** | `FormPage` slot `#fields` + `FieldGroups` (`layout: 'tabs'`/`'accordion'`) | [crud.md#fieldgroups-layouts](./crud.md#fieldgroups-layouts) |
| Dashboard / report / viewer | Pas une entité CRUD | **Custom (hors credo)** | `PageLayout` + `DataTable`/`Card` à la main, via `ctx.routes()` | [crud.md#ctxroutes](./crud.md#ctxroutes) |
| Action custom (ligne ou header) | Ouvrir un dialog, déclencher une commande… | — | `addAction` / `addHeaderAction` (onClick libre, pas forcément du routing) | [crud.md#builder-methods](./crud.md#builder-methods) |

---

## Compositions de base

Les quatre pages canoniques suivent toutes le même montage :
**builder → configure → bind** (`v-bind="x.props.value" v-on="x.events"`). Exemples complets dans [crud.md](./crud.md).

- **List page** — `useListPage({ entity })`, colonnes via slot `#columns`, filtres via `addFilter`, actions via `add*Action`.
- **Form page** — `useEntityItemFormPage({ entity })`. ⚠️ `FormPage` ne rend pas les champs tout seul : le slot `#fields` est **obligatoire**. Le mode create/edit est auto-détecté depuis la route.
- **Show page** — `useEntityItemShowPage({ entity })`, champs via slot `#fields` + `ShowField`.
- **Child list (tab)** — une `ListPage` montée sous un parent : le filtre FK est **auto-appliqué** depuis `route.meta.parent`, aucune config dans le composable.

---

## Compositions hybrides

« Détail parent + sa liste d'enfants sur la même vue » se décline en **trois** formes.
Le critère, c'est *qui héberge qui*.

### A — Onglets (`PageNav`) · *grosse liste enfant autonome*

Fiche parent (`ShowPage`) + liste enfant sur sa **propre route enfant**, présentées comme
onglets côte à côte via `PageNav`. Le filtre parent est **automatique** (la route enfant
porte le `parentId` → `route.meta.parent`).

- Déclaration : `ctx.crud(child, { list }, { parentRoute, foreignKey, label })`.
- À utiliser quand : la liste enfant est volumineuse / a besoin de ses propres filtres,
  pagination, URL. C'est le défaut, zéro glue.
- Détail : [crud.md#child-entity-list](./crud.md#child-entity-list).

### B2 — Liste enfant hôte + cartouche parent embarqué · *recommandé*

C'est **la** réponse à « une liste embarquée dans une page de détail ». La page **est** la
liste enfant (route `/parent/:id/children`) ; on affiche le **détail du parent en tête**.

Pourquoi c'est propre : sur cette route, `useListPage` fait déjà tout le travail —

- le **filtre FK est auto-injecté** depuis `route.params` (la liste est déjà scopée au parent) ;
- le composable **instancie et expose déjà le parent** : `parentData`, `parentId`,
  `parentLoading`, `parentChain`, `parentPage`. **Aucun fetch supplémentaire.**

Il reste juste à *rendre* `parentData` dans le slot `#beforeTable`. Le composant
**`<ParentCard>`** fait ça en une ligne : il dérive automatiquement les champs depuis le
manager du parent et les rend avec les **mêmes renderers que `ShowPage`** (cohérence
visuelle avec les vraies fiches, zéro re-fetch).

```vue
<script setup>
import { useListPage, ListPage, ParentCard, PageNav } from '@quazardous/qdadm'
import Column from 'primevue/column'

// Route enfant /books/:bookId/loans → parent (book) déjà résolu par useListPage
const list = useListPage({ entity: 'loans' })
list.addCreateAction('New Loan')
list.addEditAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav><PageNav /></template>

    <!-- Cartouche parent normalisé, alimenté par parentData (zéro re-fetch) -->
    <template #beforeTable>
      <ParentCard
        :entity="'books'"
        :data="list.parentData.value"
        :loading="list.parentLoading.value"
        :fields="['title', 'author']"
      />
    </template>

    <template #columns>
      <Column field="borrower_name" header="Borrower" sortable />
      <Column field="borrowed_at" header="Borrowed" sortable />
    </template>
  </ListPage>
</template>
```

`fields` est optionnel (omis → tous les champs du manager) ; le slot par défaut de
`<ParentCard>` permet de rendre le parent soi-même à partir du set de champs résolu.

> **Marche via `crud` *ou* `childPage`.** Le cartouche parent ne dépend que de
> `route.meta.parent` étant posé — donc il fonctionne aussi bien si la route enfant vient de
> `ctx.crud(child, {list}, {parentRoute, foreignKey})` que de `ctx.childPage(parent, name)`.
> Seul le **scoping de la liste** diffère : avec `foreignKey`, `useListPage` arme un filtre FK
> de requête (`useListPage.ts:944`) ; sans `foreignKey` (cas `childPage`), `parentData` /
> `parentChain` sont quand même peuplés et le scoping passe par `parentChain` + `resolveStorage`
> (endpoint imbriqué). Dans les deux cas le cartouche est identique. *(Validé sur un cas réel
> skybot — `childPage` sans `foreignKey`.)*

- À utiliser quand : la liste enfant se lit « au fil de la fiche » et on veut le contexte
  parent visible en permanence.

### B1 — Show parent hôte + liste enfant inline · *échappatoire*

L'inverse : la page **est** la fiche parent (`ShowPage`) et on embarque une `ListPage`
enfant dans un slot (`#footer` ou une section custom), **sans** onglet ni route enfant.

⚠️ Piège honnête : sur la route *show du parent*, `route.meta.parent` ne pointe pas vers
une relation enfant → **le filtre FK n'est pas auto-câblé**. Il faut l'injecter à la main :

```js
const children = useListPage({
  entity: 'loans',
  syncUrlParams: false,    // pas de bagarre sur l'URL avec la page hôte
  persistFilters: false,
  onBeforeLoad: (params) => ({ ...params, book_id: route.params.bookId }),
})
```

- À utiliser quand : petite liste contextuelle (ex. « 5 derniers prêts ») dans une fiche,
  où passer par une route enfant serait disproportionné.
- Sinon, préférer **A** (liste autonome) ou **B2** (liste hôte + parent embarqué).

### Choisir entre A / B2 / B1

| Situation | Composition |
|---|---|
| Liste enfant volumineuse, filtres/pagination/URL propres | **A (tabs)** |
| « Liste dans une fiche », on veut le parent visible en tête | **B2** (recommandé) |
| Petite liste contextuelle au fil d'une fiche parent | **B1** (échappatoire) |

---

## Custom / hors credo

Pour un dashboard, un report, un viewer — tout ce qui n'est pas une entité CRUD — un
`DataTable`/`Card` monté à la main dans une route `ctx.routes()` est légitime. Le credo
« ListPage par défaut » vise les listes d'entités, pas les vues d'agrégation.
