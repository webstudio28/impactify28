-- Allow campaign owners to read live metrics (results page + Realtime).
-- Writes stay on the service role from tracking workers.

ALTER TABLE public.campaign_metrics_live ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.campaign_metrics_live TO authenticated;

DROP POLICY IF EXISTS "Users read own campaign metrics" ON public.campaign_metrics_live;
CREATE POLICY "Users read own campaign metrics"
  ON public.campaign_metrics_live
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = campaign_metrics_live.campaign_id
        AND c.user_id = auth.uid()
    )
  );

-- Realtime live updates on the results page (optional if publication already exists).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_metrics_live;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
