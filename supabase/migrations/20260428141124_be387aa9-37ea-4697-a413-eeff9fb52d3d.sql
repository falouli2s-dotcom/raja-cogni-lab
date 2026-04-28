
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read access for exercise-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-images');

CREATE POLICY "Authenticated users can upload exercise-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exercise-images');

CREATE POLICY "Authenticated users can update exercise-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'exercise-images');

CREATE POLICY "Authenticated users can delete exercise-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'exercise-images');
