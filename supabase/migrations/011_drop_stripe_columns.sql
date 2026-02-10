-- Drop orphaned Stripe columns (replaced by NOWPayments crypto)
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_subscription_id;
