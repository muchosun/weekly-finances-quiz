import { appleRootCertificates } from './apple-roots.mjs';

export const APPLE_APP_ID=6756235224;
export const APPLE_BUNDLE_ID='com.pistonsky.FinancialPlan';
export const PRODUCTS=new Set(['com.financialplan.premium.monthly','com.financialplan.premium.yearly']);
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// A separate verifier per request avoids sharing request-bound OCSP I/O or caches.
export async function verifyApple(signedPayload,environment) {
  // jsrsasign initializes a CSPRNG; Workers requires that initialization inside
  // a request rather than during isolate startup.
  const { SignedDataVerifier, VerificationException, VerificationStatus }=await import('@apple/app-store-server-library/dist/jws_verification.js');
  const verifier=new SignedDataVerifier(appleRootCertificates.map(cert=>Buffer.from(cert,'base64')),true,environment,APPLE_BUNDLE_ID,APPLE_APP_ID);
  try {
    const notification=await verifier.verifyAndDecodeNotification(signedPayload);
    if(!uuid(notification.notificationUUID)||!Number.isSafeInteger(notification.signedDate)||notification.signedDate>Date.now()+300000)throw new Error('Invalid notification');
    const transaction=notification.data?.signedTransactionInfo?await verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo):null;
    return {notification,transaction};
  } catch(error) {
    const retryable=error instanceof VerificationException&&error.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
    throw Object.assign(new Error('Apple verification failed'),{status:retryable?503:400});
  }
}

export function normalizeTransaction(notification,t,environment,now=Date.now()) {
  if(!t)return null;
  const validId=x=>typeof x==='string'&&/^\d{1,40}$/.test(x);
  if(t.environment!==environment||t.bundleId!==APPLE_BUNDLE_ID||!PRODUCTS.has(t.productId)||
    !validId(t.transactionId)||!validId(t.originalTransactionId)||
    !Number.isSafeInteger(t.purchaseDate)||t.purchaseDate<=0||t.purchaseDate>now+300000)throw Object.assign(new Error('Invalid transaction'),{status:400});
  const price=Number.isSafeInteger(t.price)&&t.price>=0?t.price:null;
  const currency=typeof t.currency==='string'&&/^[A-Z]{3}$/.test(t.currency)?t.currency:null;
  const owned=t.inAppOwnershipType==='PURCHASED'&&t.type==='Auto-Renewable Subscription'&&!t.isUpgraded;
  const initial=owned&&notification.notificationType==='SUBSCRIBED'&&notification.subtype==='INITIAL_BUY'&&
    t.transactionReason==='PURCHASE'&&t.originalPurchaseDate===t.purchaseDate&&price>0;
  return {
    environment,transactionId:t.transactionId,originalTransactionId:t.originalTransactionId,
    appTransactionId:validId(t.appTransactionId)?t.appTransactionId:null,
    appAccountToken:uuid(t.appAccountToken)?t.appAccountToken.toLowerCase():null,
    productId:t.productId,price,currency,purchaseDate:t.purchaseDate,originalPurchaseDate:Number.isSafeInteger(t.originalPurchaseDate)?t.originalPurchaseDate:null,
    initialPaid:Number(initial),freeTrial:Number(owned&&price===0&&t.offerDiscountType==='FREE_TRIAL'),
    renewal:Number(owned&&notification.notificationType==='DID_RENEW'),
    revoked:Number(Boolean(t.revocationDate)||['REFUND','REVOKE'].includes(notification.notificationType)),receivedAt:now,
  };
}
