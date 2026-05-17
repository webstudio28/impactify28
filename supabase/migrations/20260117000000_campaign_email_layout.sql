-- Email layout style preset for template-rendered emails.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS email_layout_style text DEFAULT 'standard';
