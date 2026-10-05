# Évolutions MignonciteShop : IA admin, sécurité, suivi, Mobile Money, réglages, images, comparateur

## 1. Assistant IA de diagnostic (Admin)
Nouvel onglet « Assistant IA » dans l'administration. L'admin décrit un parcours d'achat ou un problème ; le modèle renvoie :
- les étapes reconstituées du parcours,
- les erreurs ou points de friction probables (avec gravité),
- des corrections concrètes et priorisées.
Réponse affichée au fur et à mesure. Réservé aux admins (vérifié côté serveur).

## 2. Sécurité de la vérification des rôles
- `has_role` reste utilisable par les règles d'accès, mais n'est plus appelable directement par les visiteurs anonymes.
- `documents_guard` : exécution directe retirée à tous (elle ne sert que de déclencheur).
- Passage du linter de sécurité, correction des alertes restantes.

## 3. Page « Mes commandes » (clients connectés)
- Nouvelle page `?page=orders`, accessible depuis le compte et le menu : liste des commandes liées au compte ou à l'e-mail du client, sans saisir de référence.
- Statut visuel (en attente, payée, expédiée, livrée), détail des articles, total, paiement.
- La page de suivi existante reste disponible pour les invités.

## 4. Preuve de paiement Mobile Money vérifiée automatiquement
À l'étape paiement Mobile Money :
- le client importe la capture de sa transaction ;
- l'IA lit la capture : nom du bénéficiaire, montant, référence de transaction, statut « réussi » ;
- comparaison avec le nom du bénéficiaire et le numéro configurés par l'admin, et avec le total de la commande ;
- si tout concorde → la commande passe en « paiement à confirmer / vérifié » et le tunnel continue ; sinon message clair et possibilité de réessayer ;
- la capture et le résultat sont visibles par l'admin dans la commande ; une référence déjà utilisée est refusée.

## 5. Réglages de la boutique modifiables par l'admin
Nouvel onglet « Coordonnées » : e-mail, téléphone, WhatsApp, adresse, horaires, nom du bénéficiaire Mobile Money, numéro Mobile Money. Le pied de page, la page contact, les mentions légales et le tunnel de paiement lisent ces valeurs au lieu de textes fixes.

## 6. Import d'images
Partout où une URL d'image est demandée (produits, catégories, galerie) : bouton « Importer une image » en plus du champ URL. Les images sont stockées dans l'espace de fichiers de la boutique, l'URL est remplie automatiquement.

## 7. Comparateur développé
Nouvelle page `?page=compare` :
- jusqu'à 4 produits côte à côte (prix, ancienne prix, remise, note, avis, stock, tailles, couleurs, catégorie) ;
- meilleures valeurs surlignées en doré ;
- option « afficher uniquement les différences » ;
- bouton « Analyse IA » : synthèse rapport qualité/prix et recommandation selon l'usage décrit ;
- sélection conservée sur l'appareil, barre flottante « Comparer (n) » depuis les cartes produits.

## 8. Ce qui manque pour une mise en service réelle
Livré dans le message final : paiement réel (opérateur Mobile Money / carte), domaine e-mail pour les notifications, vraies données produits, mentions légales réelles, publication et nom de domaine, sauvegardes, etc.

## Détails techniques
- Fonctions serveur (`createServerFn`) + `requireSupabaseAuth` ; contrôle admin via `has_role` sur le client utilisateur. Modèle `openai/gpt-6-astra` en Responses API, streaming ; vision pour la capture ; sortie JSON par schéma strict.
- Bucket de stockage `shop-images` (public en lecture, écriture admin) et `payment-proofs` (privé : propriétaire + admin).
- Collection `paymentProofs` dans `documents` (RLS : insertion par le propriétaire, lecture propriétaire/admin) ; la mise à jour du statut de commande se fait côté serveur après vérification.
- Migration : `REVOKE EXECUTE ... FROM anon, public` sur `has_role` / `documents_guard`.
- Le code existant des pages n'est modifié qu'aux points d'insertion (onglets admin, champ image, étape Mobile Money, liens vers les nouvelles pages).
