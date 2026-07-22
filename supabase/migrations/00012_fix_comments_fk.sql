-- Change internal_comments.author_id to reference profiles instead of auth.users
ALTER TABLE internal_comments 
  DROP CONSTRAINT IF EXISTS internal_comments_author_id_fkey;

ALTER TABLE internal_comments
  ADD CONSTRAINT internal_comments_author_id_fkey 
  FOREIGN KEY (author_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;
