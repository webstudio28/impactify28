-- Add email template columns to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS email_template_type text
    CHECK (email_template_type IN ('promotional', 'product_launch', 'seasonal', 'discount_coupon')),
  ADD COLUMN IF NOT EXISTS email_template_data jsonb,
  ADD COLUMN IF NOT EXISTS email_color_theme text DEFAULT 'midnight_blue';
