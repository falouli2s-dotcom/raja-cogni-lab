-- Tighten avatars bucket SELECT policy to prevent user UUID enumeration via listing.
-- Public URL access (/storage/v1/object/public/avatars/...) bypasses RLS so <img> tags still work.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

CREATE POLICY "Users can view own avatar files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);