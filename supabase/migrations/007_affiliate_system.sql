-- ========================================
-- AFFILIATE SYSTEM
-- ========================================

-- Add referred_by to profiles (stores affiliate code used at signup)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- ========================================
-- AFFILIATES TABLE
-- ========================================
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_affiliates_code ON affiliates(code);
CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);

-- ========================================
-- REFERRALS TABLE
-- ========================================
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES profiles ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX idx_referrals_referred_user_id ON referrals(referred_user_id);

-- ========================================
-- COMMISSIONS TABLE
-- ========================================
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX idx_commissions_status ON commissions(status);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Affiliates: users can view their own affiliate record
CREATE POLICY "Users can view own affiliate" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own affiliate" ON affiliates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own affiliate" ON affiliates
  FOR UPDATE USING (auth.uid() = user_id);

-- Referrals: affiliates can view their own referrals
CREATE POLICY "Affiliates can view own referrals" ON referrals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM affiliates WHERE affiliates.id = referrals.affiliate_id AND affiliates.user_id = auth.uid()
    )
  );

-- Commissions: affiliates can view their own commissions
CREATE POLICY "Affiliates can view own commissions" ON commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM affiliates WHERE affiliates.id = commissions.affiliate_id AND affiliates.user_id = auth.uid()
    )
  );

-- ========================================
-- UPDATE TRIGGER: save referred_by + create referral on signup
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referred_by TEXT;
  _affiliate_id UUID;
BEGIN
  _referred_by := NEW.raw_user_meta_data->>'referred_by';

  INSERT INTO public.profiles (id, email, full_name, avatar_url, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    _referred_by
  );

  -- If referred by an affiliate, create a referral record
  IF _referred_by IS NOT NULL AND _referred_by != '' THEN
    SELECT id INTO _affiliate_id
    FROM public.affiliates
    WHERE code = _referred_by AND is_active = true;

    IF _affiliate_id IS NOT NULL THEN
      INSERT INTO public.referrals (affiliate_id, referred_user_id)
      VALUES (_affiliate_id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure permissions for auth trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
GRANT ALL ON public.affiliates TO supabase_auth_admin;
GRANT ALL ON public.referrals TO supabase_auth_admin;

-- Enable Realtime for commissions
ALTER PUBLICATION supabase_realtime ADD TABLE commissions;
