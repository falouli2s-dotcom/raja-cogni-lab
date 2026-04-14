
-- Create category enum
CREATE TYPE public.exercice_categorie AS ENUM (
  'attention', 'memoire', 'flexibilite', 'inhibition', 'vitesse', 'anticipation'
);

-- Create exercices table
CREATE TABLE public.exercices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  categorie public.exercice_categorie NOT NULL,
  difficulte INTEGER NOT NULL DEFAULT 1 CHECK (difficulte BETWEEN 1 AND 3),
  duree_minutes INTEGER NOT NULL DEFAULT 5,
  instructions TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read exercises
CREATE POLICY "Authenticated users can read exercises"
  ON public.exercices FOR SELECT
  TO authenticated
  USING (true);

-- Seed 20 exercises
INSERT INTO public.exercices (titre, description, categorie, difficulte, duree_minutes, instructions) VALUES
('Double Tâche Visuelle', 'Suivre deux objets en mouvement simultanément pour améliorer l''attention divisée.', 'attention', 2, 10, 'Suivez les deux cercles en mouvement et cliquez quand ils se croisent.'),
('Écoute Sélective', 'Filtrer les sons pertinents parmi des distracteurs auditifs.', 'attention', 1, 8, 'Écoutez attentivement et identifiez le son cible parmi les distracteurs.'),
('Vigilance Continue', 'Maintenir l''attention sur une longue durée pour détecter des stimuli rares.', 'attention', 3, 15, 'Restez concentré et appuyez dès que le stimulus cible apparaît.'),
('Séquence Mnésique', 'Mémoriser et reproduire des séquences de plus en plus longues.', 'memoire', 1, 8, 'Observez la séquence puis reproduisez-la dans le bon ordre.'),
('Mémoire Spatiale', 'Retenir la position d''objets dans un espace 2D.', 'memoire', 2, 10, 'Mémorisez les positions des objets puis replacez-les correctement.'),
('Mise à Jour Continue', 'Mettre à jour en permanence les informations en mémoire de travail.', 'memoire', 3, 12, 'Retenez les N derniers éléments présentés et rappelez-les à la demande.'),
('Mémoire Associative', 'Associer des paires d''images ou de mots pour renforcer l''encodage.', 'memoire', 1, 7, 'Apprenez les paires puis retrouvez l''association correcte.'),
('Catégorisation Rapide', 'Alterner rapidement entre différentes règles de tri.', 'flexibilite', 2, 10, 'Triez les cartes selon la règle affichée, qui change régulièrement.'),
('Règle Alternée', 'Alterner entre deux consignes opposées sans erreur.', 'flexibilite', 1, 8, 'Suivez la consigne active. Elle alterne à chaque signal sonore.'),
('Adaptation Tactique', 'S''adapter à des changements de stratégie en situation de jeu simulé.', 'flexibilite', 3, 15, 'Adaptez votre stratégie de jeu en fonction des changements de règles.'),
('Stop Signal', 'Inhiber une réponse automatique quand un signal d''arrêt apparaît.', 'inhibition', 2, 10, 'Appuyez rapidement sauf quand le signal rouge apparaît.'),
('Stroop Sportif', 'Résister à l''interférence entre la lecture et la couleur dans un contexte sportif.', 'inhibition', 2, 8, 'Identifiez la couleur du mot, pas le mot lui-même.'),
('Contrôle Impulsif', 'Retenir une action impulsive et choisir la réponse correcte.', 'inhibition', 1, 7, 'Attendez le bon signal avant de répondre, résistez à l''envie de cliquer trop vite.'),
('Go/No-Go Avancé', 'Version complexe du paradigme Go/No-Go avec stimuli variables.', 'inhibition', 3, 12, 'Répondez aux stimuli Go et inhibez votre réponse aux stimuli No-Go.'),
('Temps de Réaction Simple', 'Améliorer la vitesse de réaction à un stimulus unique.', 'vitesse', 1, 5, 'Cliquez le plus vite possible dès que le stimulus apparaît.'),
('Temps de Réaction à Choix', 'Réagir rapidement en choisissant la bonne réponse parmi plusieurs options.', 'vitesse', 2, 8, 'Choisissez la bonne réponse le plus rapidement possible.'),
('Sprint Cognitif', 'Enchaîner des décisions rapides sous pression temporelle.', 'vitesse', 3, 10, 'Répondez correctement à un maximum de questions en temps limité.'),
('Lecture de Jeu', 'Anticiper les mouvements adverses dans des situations de jeu simplifiées.', 'anticipation', 2, 12, 'Observez la situation et prédisez le prochain mouvement.'),
('Prédiction de Trajectoire', 'Prédire la trajectoire d''un objet en mouvement après occlusion.', 'anticipation', 1, 8, 'Suivez l''objet puis cliquez à l''endroit où il réapparaîtra.'),
('Timing Perceptif', 'Synchroniser une action avec un événement temporel précis.', 'anticipation', 3, 10, 'Appuyez exactement au moment où l''objet atteint la cible.');
