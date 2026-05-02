# Diagrammes UML — CogniRaja

Cinq diagrammes UML en syntaxe **PlantUML** couvrant l'architecture et les flux de l'application CogniRaja.

## Comment visualiser

Copier le contenu d'un fichier `.puml` et le coller dans [PlantText](https://www.planttext.com/) ou dans tout outil compatible PlantUML (VS Code extension, IntelliJ, etc.).

---

## Fichiers

| Fichier | Type | Description |
|---------|------|-------------|
| `01_cas_utilisation.puml` | Cas d'utilisation | Acteurs (Joueur, Coach, Admin, Système) et tous les cas d'usage |
| `02_classes.puml` | Classes | Modèle objet complet : Utilisateurs, Tests, SGS, Exercices, Notifications |
| `03_composants.puml` | Composants | Architecture frontend React, Cloudflare Workers, Supabase |
| `04_activite.puml` | Activité | Flux complet d'une session (swimlanes Joueur / Système) |
| `05_sequence.puml` | Séquence | Batterie complète : auth → Simon → N-Back → TMT → SGS → recommandations |

---

## Points clés reflétés dans les diagrammes

- **SGS à 5 dimensions** (l'Anticipation Perceptuelle est réservée pour la v2) :
  Flexibilité (28%) · Attention (22%) · Mémoire de travail (22%) · Inhibition (17%) · Temps de réaction (11%)

- **Schéma `exercices`** tel qu'issu des migrations Supabase :
  `bloc`, `niveau`, `indicateur_cognitif`, `alignement_test_digital`, `stimulus_detail` (JSONB), etc.

- **`resultats_test.metrique`** : `simon_effect` / `target_error_rate` / `ratio_ba`
  avec les données complémentaires dans le champ `details` (JSON).

- **Triggers PostgreSQL** : `notify_player_on_session_planned`, `recompute_sgs_global()`

- **Stack technique** : React 19 + TypeScript, TanStack Router/Query, Supabase, Cloudflare Workers, Bun
