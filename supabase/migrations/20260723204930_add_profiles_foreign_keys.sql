-- Add foreign key constraints to profiles so PostgREST can auto-join them

ALTER TABLE team_members
ADD CONSTRAINT team_members_user_id_profiles_fk
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;

ALTER TABLE inbox_members
ADD CONSTRAINT inbox_members_user_id_profiles_fk
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;

ALTER TABLE internal_comments
ADD CONSTRAINT internal_comments_author_id_profiles_fk
FOREIGN KEY (author_id) REFERENCES profiles(id)
ON DELETE CASCADE;
