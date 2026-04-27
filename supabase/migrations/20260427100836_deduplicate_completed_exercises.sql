-- Remove duplicate completed_exercises rows, keeping only the most recent
-- per (user_id, exercise_id, planning_id) partition.
DELETE FROM completed_exercises
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, exercise_id, planning_id
        ORDER BY completed_at DESC
      ) as rn
    FROM completed_exercises
  ) ranked
  WHERE rn > 1
);

-- Remove orphan NULL planning_id rows that have a corresponding row
-- with planning_id set, completed within 5 seconds of each other.
DELETE FROM completed_exercises ce1
WHERE ce1.planning_id IS NULL
AND EXISTS (
  SELECT 1 FROM completed_exercises ce2
  WHERE ce2.exercise_id = ce1.exercise_id
  AND ce2.user_id = ce1.user_id
  AND ce2.planning_id IS NOT NULL
  AND ce2.completed_at > ce1.completed_at - interval '5 seconds'
);
