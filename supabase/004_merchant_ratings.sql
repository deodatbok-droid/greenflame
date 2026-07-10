-- Add rating columns to merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- Create merchant_ratings table for future user reviews
CREATE TABLE IF NOT EXISTS public.merchant_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, user_id)
);

ALTER TABLE public.merchant_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings" ON public.merchant_ratings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can rate" ON public.merchant_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating" ON public.merchant_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to refresh merchant avg_rating and review_count
CREATE OR REPLACE FUNCTION refresh_merchant_rating(p_merchant_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.merchants m
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM public.merchant_ratings WHERE merchant_id = p_merchant_id
    ), m.avg_rating),
    review_count = (
      SELECT COUNT(*) FROM public.merchant_ratings WHERE merchant_id = p_merchant_id
    )
  WHERE id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-refresh after insert/update/delete
CREATE OR REPLACE FUNCTION trg_refresh_merchant_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_merchant_rating(OLD.merchant_id);
  ELSE
    PERFORM refresh_merchant_rating(NEW.merchant_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchant_rating_refresh ON public.merchant_ratings;
CREATE TRIGGER merchant_rating_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.merchant_ratings
  FOR EACH ROW EXECUTE FUNCTION trg_refresh_merchant_rating();

-- Seed demo ratings (4.3 – 4.9 range) for existing merchants
UPDATE public.merchants SET avg_rating = 4.7 + (RANDOM() * 0.3)::DECIMAL(3,2), review_count = FLOOR(RANDOM() * 45 + 5)::INT;
