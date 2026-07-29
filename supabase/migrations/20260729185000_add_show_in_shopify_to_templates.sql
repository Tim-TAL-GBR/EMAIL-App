-- Add show_in_shopify column to templates table
-- Default is false to keep Shopify clean by default

ALTER TABLE templates 
ADD COLUMN show_in_shopify BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN templates.show_in_shopify IS 'Ob diese Vorlage als Option in der Shopify E-Mail App angezeigt werden soll';
