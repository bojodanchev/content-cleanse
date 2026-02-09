-- Add crypto payment support to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- Payments table to track crypto payment history
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  charge_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'agency')),
  amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  crypto_currency TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_charge_id ON payments(charge_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all payments (for webhook handler)
CREATE POLICY "Service role can manage payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');

-- Function to auto-downgrade expired plans
CREATE OR REPLACE FUNCTION check_expired_plans()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET plan = 'free', monthly_quota = 5
  WHERE plan != 'free'
    AND plan_expires_at IS NOT NULL
    AND plan_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for payments table too
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
