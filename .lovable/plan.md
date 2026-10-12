# Simplifier et sécuriser MignonciteShop

## Objectif
Une boutique mono-vendeur en français, conservant son identité dorée, avec un achat simple et un paiement uniquement à la livraison.

## 1. Commande et paiement
- Remplacer les formulaires carte, PayPal et Mobile Money par une confirmation « Paiement à la livraison », sans demande de coordonnées bancaires ni capture de transaction.
- Préremplir l’e-mail et le nom du client connecté ; demander les coordonnées nécessaires à la livraison, avec un téléphone obligatoire et une adresse adaptée à la Côte d’Ivoire plutôt que les pays et codes postaux européens actuellement imposés.
- Calculer les prix, remises, frais et disponibilités à partir des données de la boutique ; rendre la création de commande atomique pour éviter les commandes partielles et les dépassements de stock.
- Réserver le stock lors de la commande, le restituer une seule fois en cas d’annulation et séparer l’état de livraison de l’état du paiement.
- N’accorder les points de fidélité qu’après livraison et encaissement confirmé, jamais lors d’une commande impayée.
- Retirer les réglages et messages des anciens paiements, y compris dans l’administration et l’assistant IA.

## 2. Sécurité
- Supprimer la lecture publique des suivis de commandes : un client connecté consulte ses propres commandes sans saisir de nouveau son e-mail.
- Fermer les écritures directes permettant de falsifier une commande, des points de fidélité ou l’utilisation d’une promotion.
- Protéger les exports contre les formules malveillantes dans les noms et autres champs.
- Limiter l’accès direct au stockage des images aux administrateurs ; conserver l’affichage des photos commerciales via leurs liens signés.
- Vérifier la fonction de rôles et ses autorisations sans affaiblir la protection de l’administration.

## 3. Produits et présentation
- Ouvrir la fiche produit depuis le nom, les informations et les actions produit sur toutes les listes, y compris l’accueil.
- Réserver le clic sur l’image à une visionneuse avec photo entière, proportions respectées, navigation entre les photos et fermeture accessible.
- Retirer l’historique de prix, actuellement simulé, et les indications qui en dépendent.
- Harmoniser les transitions existantes et respecter la préférence de réduction des animations, sans refaire entièrement la boutique.

## 4. Connexion et compte
- Masquer le pied de page et les éléments flottants superflus sur la connexion.
- Afficher la photo Google lorsqu’elle existe, sinon un avatar avec initiales.
- Ajouter la modification du nom et le choix d’un avatar, enregistrés dans le profil et visibles immédiatement.
- Harmoniser les étapes de suivi avec le paiement à la livraison et afficher les erreurs de chargement plutôt qu’un faux état vide.

## 5. Référencement
- Corriger la hiérarchie des titres de la page À propos et la devise des données produit en XOF.
- Supprimer le titre redondant et fournir les titres, descriptions et aperçus propres aux pages publiques.
- Ajouter un sitemap des pages réellement publiques, excluant connexion, compte, administration, paiement et réinitialisation du mot de passe.
- Préserver la navigation actuelle en paramètres d’URL ; ne pas ajouter de pages doublonnées pour le référencement.
- Ne pas placer d’image sociale globale sur la racine : une image pertinente doit appartenir à la page concernée.

## Vérifications et livraison
- Ajouter des tests sur le paiement à la livraison, les quantités, les calculs, les droits d’accès, les points et les exports.
- Vérifier un achat connecté complet, sa consultation dans le compte, ainsi que les actions administrateur accessibles avec un compte autorisé.
- Contrôler la navigation produit, la visionneuse, le profil, la connexion et les erreurs visibles.
- Fournir les limites restantes avant mise en service : vrais produits et coordonnées, organisation des livraisons, envoi effectif des e-mails et publication. Aucun prestataire de paiement en ligne n’est nécessaire pour cette version.

## Détails techniques
- Conserver les composants existants, les adaptateurs Firestore et la navigation `/?page=...`.
- Déplacer les opérations sensibles de commande vers une fonction serveur authentifiée et une transaction PostgreSQL ; appliquer les règles de propriété et d’administration dans la base.
- Conserver les rôles protégés dans `user_roles`, avec la fonction interne `private.has_role` et son enveloppe publique limitée au demandeur.
- Installer le sitemap suivant le modèle TanStack du projet, sans dates de modification inventées ni accès privilégié aux contenus publics.