-- Migration: Add snooze_until to emails

ALTER TABLE emails ADD COLUMN snooze_until TIMESTAMPTZ;

COMMENT ON COLUMN emails.snooze_until IS 'Zeitpunkt bis zu dem die E-Mail versteckt (snoozed) wird. NULL bedeutet nicht gesnoozed.';
