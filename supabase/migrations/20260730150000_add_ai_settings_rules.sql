ALTER TABLE org_ai_settings ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN org_ai_settings.settings IS 'JSON object with AI behaviour rules: no_greeting, no_signature, salutation_form, include_customer_name, tone, allow_emoji, response_length';
