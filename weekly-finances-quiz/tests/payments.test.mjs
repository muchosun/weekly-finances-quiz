import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { APPLE_BUNDLE_ID,normalizeTransaction,verifyApple } from '../payments/apple.mjs';
import { createAttribution,recordNotification,validAttribution } from '../payments/ledger.mjs';
import { flushPayments,conversionCsv } from '../payments/metrica.mjs';
import { appleNotification } from '../payments/handler.mjs';

const now=Date.now(),product='com.financialplan.premium.monthly';
const base={bundleId:APPLE_BUNDLE_ID,environment:'Production',transactionId:'10001',originalTransactionId:'10001',appTransactionId:'50001',productId:product,price:1990,currency:'USD',purchaseDate:now-1000,originalPurchaseDate:now-1000,inAppOwnershipType:'PURCHASED',type:'Auto-Renewable Subscription',transactionReason:'PURCHASE',quantity:1};
const notification=(overrides={})=>({notificationUUID:crypto.randomUUID(),notificationType:'SUBSCRIBED',subtype:'INITIAL_BUY',signedDate:now,...overrides});
async function fixture(fn){
  // The installed workerd binary currently supports dates through 2026-08-06.
  // Production retains 2026-11-05 and is checked separately after deployment.
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-08-06',d1Databases:['DB']});
  try{const db=await mf.getD1Database('DB');await db.exec((await readFile(new URL('../payments/schema.sql',import.meta.url),'utf8')).replace(/\n/g,' '));await fn(db);}finally{await mf.dispose();}
}
async function linked(db){return createAttribution(db,{analyticsAllowed:true,clientId:'1234567890123456789',yclid:'9876543210987654321'},now-2000);}
const count=async(db,table)=>Number((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n);
const save=(db,n,t)=>recordNotification(db,n,normalizeTransaction(n,t,t.environment,now),t.environment,now);

test('attribution requires explicit analytics permission and numeric string IDs',()=>{
  assert.equal(validAttribution({analyticsAllowed:true,clientId:'123'}),true);
  for(const value of [{clientId:'123'},{analyticsAllowed:false,clientId:'123'},{analyticsAllowed:true,clientId:123},{analyticsAllowed:true,clientId:'=FORMULA'},{analyticsAllowed:true,clientId:'123',income:4000}])assert.equal(Boolean(validAttribution(value)),false);
});
test('first linked production payment is queued once, including concurrent duplicate deliveries',()=>fixture(async db=>{
  const appAccountToken=await linked(db),n=notification(),t={...base,appAccountToken};
  await Promise.all([save(db,n,t),save(db,n,t)]);
  assert.equal(await count(db,'apple_notifications'),1);assert.equal(await count(db,'apple_transactions'),1);assert.equal(await count(db,'payment_conversions'),1);
}));
test('sandbox and unmatched purchases never become advertising conversions',()=>fixture(async db=>{
  const appAccountToken=await linked(db);
  await save(db,notification(),{...base,environment:'Sandbox',appAccountToken});
  await save(db,notification(),{...base});
  assert.equal(await count(db,'apple_transactions'),2);assert.equal(await count(db,'payment_conversions'),0);
}));
test('unknown renewals, resubscriptions, zero/missing price, shared purchases and upgrades are excluded',()=>fixture(async db=>{
  const appAccountToken=await linked(db);
  const cases=[
    [notification({notificationType:'DID_RENEW'}),{transactionReason:'RENEWAL'}],
    [notification({subtype:'RESUBSCRIBE'}),{}],
    [notification(),{price:0,offerDiscountType:'FREE_TRIAL'}],
    [notification(),{price:undefined}],
    [notification(),{currency:undefined}],
    [notification(),{inAppOwnershipType:'FAMILY_SHARED'}],
    [notification(),{isUpgraded:true}],
  ];
  for(let i=0;i<cases.length;i++){const [n,change]=cases[i];await save(db,n,{...base,appAccountToken,transactionId:String(11000+i),originalTransactionId:String(11000+i),...change});}
  assert.equal(await count(db,'payment_conversions'),0);
}));
test('trial to first paid renewal works with out-of-order notifications',()=>fixture(async db=>{
  const appAccountToken=await linked(db);
  await save(db,notification({notificationType:'DID_RENEW'}),{...base,appAccountToken,transactionId:'10002',transactionReason:'RENEWAL',originalPurchaseDate:now-1500});
  assert.equal(await count(db,'payment_conversions'),0);
  await save(db,notification(),{...base,appAccountToken,price:0,offerDiscountType:'FREE_TRIAL',purchaseDate:now-1500,originalPurchaseDate:now-1500});
  assert.equal(await count(db,'payment_conversions'),1);
  await save(db,notification({notificationType:'DID_RENEW'}),{...base,appAccountToken,transactionId:'10003',transactionReason:'RENEWAL',purchaseDate:now-500});
  assert.equal(await count(db,'payment_conversions'),1);
}));
test('refund before export cancels pending conversion and cannot be undone by a duplicate purchase',()=>fixture(async db=>{
  const appAccountToken=await linked(db);await save(db,notification(),{...base,appAccountToken});
  await save(db,notification({notificationType:'REFUND'}),{...base,appAccountToken,revocationDate:now});
  await save(db,notification(),{...base,appAccountToken});
  assert.equal((await db.prepare('SELECT state FROM payment_conversions').first()).state,'revoked');
  assert.equal((await db.prepare('SELECT revoked FROM apple_transactions').first()).revoked,1);
}));
test('conversion upload is serialized, correctly priced, and polled separately',()=>fixture(async db=>{
  const appAccountToken=await linked(db);await save(db,notification(),{...base,appAccountToken});
  const env={PAYMENTS_DB:db,PAYMENT_EXPORT_ENABLED:'1',METRICA_OAUTH_TOKEN:'test-only-not-a-real-token',METRICA_COUNTER_ID:'123'};
  let uploads=0;
  const fetcher=async(url,options)=>{
    if(options.method==='POST'){
      uploads++;const csv=await options.body.get('file').text();assert.match(csv,/Yclid,Target,DateTime,Price,Currency/);assert.match(csv,/,app_first_payment,\d+,1.99,USD/);
      return Response.json({uploading:{id:100,status:'UPLOADED'}});
    }
    return Response.json({uploading:{id:100,status:'PROCESSED'}});
  };
  await Promise.all([flushPayments(env,{fetcher,now}),flushPayments(env,{fetcher,now})]);assert.equal(uploads,1);
  await flushPayments(env,{fetcher,now});assert.equal((await db.prepare('SELECT state FROM payment_conversions').first()).state,'processed');
}));
test('ambiguous upload response is not retried and disabled export performs no network calls',()=>fixture(async db=>{
  const appAccountToken=await linked(db);await save(db,notification(),{...base,appAccountToken});
  const env={PAYMENTS_DB:db,PAYMENT_EXPORT_ENABLED:'1',METRICA_OAUTH_TOKEN:'test-only-not-a-real-token',METRICA_COUNTER_ID:'123'};let calls=0;
  const fetcher=async()=>{calls++;throw new Error('connection lost');};
  await flushPayments({...env,PAYMENT_EXPORT_ENABLED:'0'},{fetcher,now});assert.equal(calls,0);
  await flushPayments(env,{fetcher,now});await flushPayments(env,{fetcher,now});assert.equal(calls,1);
  assert.equal((await db.prepare('SELECT state FROM payment_conversions').first()).state,'uncertain');
}));
test('Apple endpoint rejects forged, oversized and malformed requests without recording data',()=>fixture(async db=>{
  const env={PAYMENTS_DB:db};const req=body=>new Request('https://quiz.example/api/apple/notifications/production',{method:'POST',headers:{'Content-Type':'application/json'},body});
  assert.equal((await appleNotification(req('{broken'),env,'Production')).status,400);
  assert.equal((await appleNotification(req('x'.repeat(131073)),env,'Production')).status,413);
  assert.equal((await appleNotification(req(JSON.stringify({signedPayload:'x'.repeat(40)})),env,'Production')).status,400);
  assert.equal(await count(db,'apple_notifications'),0);
  await assert.rejects(()=>verifyApple('x'.repeat(40),'Production'));
}));
test('verified Apple test notification succeeds without manufacturing a payment',()=>fixture(async db=>{
  const n=notification({notificationType:'TEST'});
  const request=new Request('https://quiz.example/api/apple/notifications/sandbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signedPayload:'fixture-signed-payload-is-not-a-real-token'})});
  assert.equal((await appleNotification(request,{PAYMENTS_DB:db},'Sandbox',{verify:async()=>({notification:n,transaction:null}),now})).status,200);
  assert.equal(await count(db,'apple_notifications'),1);assert.equal(await count(db,'apple_transactions'),0);assert.equal(await count(db,'payment_conversions'),0);
}));
test('CSV refuses invalid identifiers and maps Apple milliunits to currency units',()=>{
  assert.equal(conversionCsv({price_milliunits:1990,currency:'USD',purchase_date:100000},{client_id:'123'}),'ClientId,Target,DateTime,Price,Currency\n123,app_first_payment,100,1.99,USD\n');
  assert.throws(()=>conversionCsv({price_milliunits:1990,currency:'USD',purchase_date:100000},{client_id:'=bad'}));
});
