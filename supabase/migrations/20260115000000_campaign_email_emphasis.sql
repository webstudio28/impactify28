-- Typography emphasis preset for template-rendered email (balanced vs bold hierarchy)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS email_emphasis_preset text DEFAULT 'bold';
