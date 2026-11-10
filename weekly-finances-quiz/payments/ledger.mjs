import { uuid } from './apple.mjs';
export const ATTRIBUTION_WINDOW_MS=21*86400000;

export function validAttribution(data) {
  return data&&typeof data==='object'&&!Array.isArray(data)&&
    Object.keys(data).every(k=>['analyticsAllowed','clientId','yclid'].includes(k))&&data.analyticsAllowed===true&&
    (data.clientId===undefined||(typeof data.clientId==='string'&&/^\d{1,32}$/.test(data.clientId)))&&
    (data.yclid===undefined||(typeof data.yclid==='string'&&/^\d{1,64}$/.test(data.yclid)))&&
    (typeof data.clientId==='string'||typeof data.yclid==='string');
}

export async function createAttribution(db,data,now=Date.now()) {
  if(!validAttribution(data))throw Object.assign(new Error('Invalid attribution'),{status:400});
  const appAccountToken=crypto.randomUUID();
  await db.prepare('INSERT INTO payment_attribution VALUES (?, ?, ?, ?, ?)').bind(appAccountToken,data.clientId||null,data.yclid||null,now,now+ATTRIBUTION_WINDOW_MS).run();
  return appAccountToken;
}

export async function recordNotification(db,n,t,environment,now=Date.now()) {
  const statements=[db.prepare('INSERT OR IGNORE INTO apple_notifications VALUES (?, ?, ?, ?)').bind(environment,n.notificationUUID,n.notificationType,now)];
  if(t)statements.push(db.prepare(`INSERT INTO apple_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(environment,transaction_id) DO UPDATE SET
      revoked=MAX(apple_transactions.revoked,excluded.revoked),
      initial_paid=MAX(apple_transactions.initial_paid,excluded.initial_paid),
      free_trial=MAX(apple_transactions.free_trial,excluded.free_trial),
      renewal=MAX(apple_transactions.renewal,excluded.renewal)`)
    .bind(t.environment,t.transactionId,t.originalTransactionId,t.appTransactionId,t.appAccountToken,t.productId,t.price,t.currency,t.purchaseDate,t.originalPurchaseDate,t.initialPaid,t.freeTrial,t.renewal,t.revoked,t.receivedAt));
  await db.batch(statements);
  await queueFirstPayments(db,now);
}

export async function queueFirstPayments(db,now=Date.now()) {
  // Unmatched purchases are retained in the ledger, never guessed or assigned
  // to the most recent quiz visitor. Unknown pre-integration renewals are excluded.
  await db.prepare(`INSERT OR IGNORE INTO payment_conversions
    (subject_key,app_account_token,transaction_id,purchase_date,price_milliunits,currency,updated_at)
    SELECT CASE WHEN t.app_transaction_id IS NOT NULL THEN 'apple:'||t.app_transaction_id ELSE 'anon:'||t.app_account_token END,
      t.app_account_token,t.transaction_id,t.purchase_date,t.price_milliunits,t.currency,?
    FROM apple_transactions t JOIN payment_attribution a ON a.app_account_token=t.app_account_token
    WHERE t.environment='Production' AND t.revoked=0 AND t.price_milliunits>0 AND t.currency IS NOT NULL
      AND a.created_at<=t.purchase_date AND a.expires_at>=? AND a.expires_at>=t.purchase_date AND t.purchase_date<=?
      AND (t.initial_paid=1 OR (t.renewal=1 AND EXISTS (
        SELECT 1 FROM apple_transactions z WHERE z.environment=t.environment
          AND z.original_transaction_id=t.original_transaction_id AND z.free_trial=1 AND z.purchase_date<t.purchase_date)))
      AND NOT EXISTS (SELECT 1 FROM apple_transactions p WHERE p.environment=t.environment AND p.price_milliunits>0
        AND (p.app_account_token=t.app_account_token OR p.original_transaction_id=t.original_transaction_id
          OR (t.app_transaction_id IS NOT NULL AND p.app_transaction_id=t.app_transaction_id))
        AND (p.purchase_date<t.purchase_date OR (p.purchase_date=t.purchase_date AND p.transaction_id<t.transaction_id)))
    ORDER BY t.purchase_date,t.transaction_id`).bind(now,now,now).run();
  await db.prepare(`UPDATE payment_conversions SET state='revoked',updated_at=? WHERE state='pending' AND transaction_id IN
    (SELECT transaction_id FROM apple_transactions WHERE environment='Production' AND revoked=1)`).bind(now).run();
}

export async function claimConversion(db,now) {
  // One atomic UPDATE serializes concurrent cron/request dispatchers.
  return db.prepare(`UPDATE payment_conversions SET state='sending',updated_at=?,attempts=attempts+1
    WHERE subject_key=(SELECT c.subject_key FROM payment_conversions c JOIN payment_attribution a USING(app_account_token)
      WHERE c.state='pending' AND a.expires_at>=? ORDER BY c.purchase_date LIMIT 1) AND state='pending' RETURNING *`).bind(now,now).first();
}

export async function attributionFor(db,appAccountToken) {
  if(!uuid(appAccountToken))return null;
  return db.prepare('SELECT client_id,yclid FROM payment_attribution WHERE app_account_token=?').bind(appAccountToken).first();
}
