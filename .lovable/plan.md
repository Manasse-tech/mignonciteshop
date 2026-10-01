# Reconstruction de MignonciteShop

Votre dépôt a bien été récupéré : une boutique en ligne complète (accueil, boutique, fiche produit, panier, commande, suivi, favoris, compte, administration, pages légales) qui utilise aujourd'hui Firebase pour les données et la connexion.

## Ce qui sera fait

1. **Reprise fidèle de l'interface** — mêmes pages, mêmes textes, mêmes images produits, même logo et mêmes couleurs. Le code de vos composants est conservé tel quel autant que possible ; seuls les branchements techniques changent.
2. **Nouveau backend avec Lovable Cloud** (remplace Firebase) :
   - Produits, catégories, avis, promotions / codes promo
   - Commandes et suivi de commande, alertes de stock
   - Messages de contact, newsletter, points de fidélité
   - Paramètres de la boutique et journal d'administration
   - Stockage des photos produits
3. **Authentification** — inscription / connexion par e-mail + mot de passe et connexion Google, profil client, page "Mon compte" protégée, rôle administrateur sécurisé (seuls les admins accèdent au tableau de bord).
4. **Améliorations visuelles légères** — même identité, mais finitions plus soignées : espacements, typographie plus nette, cartes produits et boutons plus homogènes, meilleures transitions, affichage mobile peaufiné.
5. **Données de départ** — les produits et catégories de démonstration du dépôt sont pré-chargés pour que la boutique ne soit pas vide.

## Étapes

```text
1. Activer Lovable Cloud + créer les tables et la sécurité
2. Copier le design (couleurs, polices, images) et les composants
3. Créer une vraie page par section (/boutique, /panier, /produit/..., /compte, /admin...)
4. Rebrancher toutes les fonctions de données sur le nouveau backend
5. Connexion e-mail + Google, rôle admin
6. Polissage visuel et vérification complète (inscription, panier, commande, admin)
```

## Points à noter

- Le paiement réel n'est pas inclus dans cette étape (la commande est enregistrée comme aujourd'hui) ; il pourra être ajouté ensuite.
- Le premier compte administrateur sera attribué à votre e-mail après votre inscription.

## Détails techniques

- Next.js -> TanStack Start : `page.tsx` (navigation par état) devient des routes fichiers ; `next/navigation`, `next/image`, `next-intl`, `next-themes` remplacés par leurs équivalents.
- `src/lib/api.ts` (Firestore) réécrit avec le même contrat de fonctions sur les tables Cloud + RLS ; `auth-store.ts` (zustand) conservé, adossé à l'auth Cloud.
- Rôles dans une table `user_roles` séparée + fonction `has_role`. Opérations admin via fonctions serveur vérifiées.
- Dépendances incompatibles retirées (`sharp`, `z-ai-web-dev-sdk`, `firebase`).
