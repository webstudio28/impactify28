-- Email typography: persisted font choice for template-rendered campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS email_font_family text DEFAULT 'montserrat';
