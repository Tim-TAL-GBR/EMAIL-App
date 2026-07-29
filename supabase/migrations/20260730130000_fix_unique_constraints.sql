-- Fix: replace unique indexes with unique constraints for PostgREST upsert support

-- user_preferences: clean duplicates and add constraint
DELETE FROM user_preferences a USING (
  SELECT MIN(id) as id, user_id FROM user_preferences GROUP BY user_id HAVING COUNT(*) > 1
) b WHERE a.user_id = b.user_id AND a.id <> b.id;

DROP INDEX IF EXISTS idx_user_preferences_user_id;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);

-- org_ai_settings: clean duplicates and add constraint
DELETE FROM org_ai_settings a USING (
  SELECT MIN(id) as id, org_id FROM org_ai_settings GROUP BY org_id HAVING COUNT(*) > 1
) b WHERE a.org_id = b.org_id AND a.id <> b.id;

DROP INDEX IF EXISTS idx_org_ai_settings_org_id;
ALTER TABLE org_ai_settings ADD CONSTRAINT org_ai_settings_org_id_key UNIQUE (org_id);
