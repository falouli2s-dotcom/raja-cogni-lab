

# CogniRaja — Plan d'implémentation approuvé

## Phase 1: Fondations & Design System
- Couleurs Raja dans Tailwind CSS v4 (#00A651, #1A1A1A, #FF6B00)
- Dépendances: date-fns, recharts, zod, react-hook-form, framer-motion, lucide-react
- Layout mobile + Bottom Navigation Bar (5 onglets)
- Splash Screen: animation 2.5s, session active → /home, sinon → /login

## Phase 2: Base de données Supabase
- Tables: profiles, sessions_test, resultats_test, exercices, exercices_completes
- RLS sur toutes les tables, seed 20 exercices
- Catégorie auto-calculée (U13-U17)

## Phase 3: Authentification
- Login email/password + Google OAuth + mot de passe oublié
- Inscription 2 étapes, indicateur force mot de passe
- Déconnexion: signOut + navigate replace → stack navigation réinitialisé
- Guard via _authenticated layout route

## Phase 4-5: Accueil + Liste Tests
- Accueil: salutation, SGS, CTA, stats rapides, exercices recommandés
- 3 tests avec pré-test (instructions, durée, boutons)

## Phase 6: Passation des Tests
- Entraînement obligatoire, non skippable, feedback visuel+textuel, écran transition
- Simon Task: 10 entraînement + 30 essais (500ms ISI, 1500ms limite)
- N-Back 2: 10 entraînement + 80 stimuli (25% cibles)
- TMT: A (1→25) + B (1→A→2→B→13), feedback erreurs

## Phase 7: Résultats & SGS
- SGS pondéré, Anticipation fixée à 50 (non mesurée MVP)
- Radar chart hexagonal (Recharts), interprétation SGS

## Phase 8-9: Résultats + Exercices
- Historique, courbes évolution, filtres, badges progression
- Recommandations rule-based: TR>450ms, B/A>2.5, N-Back erreurs>30%, Simon>80ms, DT<50%
- Catalogue 20 exercices avec filtres et détails

## Phase 10: Profil
- Identité, stats, paramètres, déconnexion (rouge, stack reset)

## Hors scope MVP
- Mode offline → V2
- Notifications push → V2
- Anticipation → valeur par défaut 50

