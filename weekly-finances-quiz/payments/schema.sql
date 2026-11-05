CREATE TABLE IF NOT EXISTS payment_attribution (
  app_account_token TEXT PRIMARY KEY,
  client_id TEXT,
  yclid TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (client_id IS NOT NULL OR yclid IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS apple_notifications (
  environment TEXT NOT NULL,
  notification_uuid TEXT NOT NULL,
  kind TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (environment, notification_uuid)
);
CREATE TABLE IF NOT EXISTS apple_transactions (
  environment TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  original_transaction_id TEXT NOT NULL,
  app_transaction_id TEXT,
  app_account_token TEXT,
  product_id TEXT NOT NULL,
  price_milliunits INTEGER,
  currency TEXT,
  purchase_date INTEGER NOT NULL,
  original_purchase_date INTEGER,
  initial_paid INTEGER NOT NULL DEFAULT 0,
  free_trial INTEGER NOT NULL DEFAULT 0,
  renewal INTEGER NOT NULL DEFAULT 0,
  revoked INTEGER NOT NULL DEFAULT 0,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (environment, transaction_id)
);
CREATE INDEX IF NOT EXISTS apple_customer_transactions ON apple_transactions(environment, app_account_token, purchase_date);
CREATE INDEX IF NOT EXISTS apple_original_transactions ON apple_transactions(environment, original_transaction_id, purchase_date);
CREATE TABLE IF NOT EXISTS payment_conversions (
  subject_key TEXT PRIMARY KEY,
  app_account_token TEXT NOT NULL UNIQUE,
  transaction_id TEXT NOT NULL UNIQUE,
  purchase_date INTEGER NOT NULL,
  price_milliunits INTEGER NOT NULL,
  currency TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  uploading_id TEXT,
  updated_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
