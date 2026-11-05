import { claimConversion, attributionFor, queueFirstPayments } from './ledger.mjs';

export const PAYMENT_GOAL='app_first_payment';
export function conversionCsv(row,attribution) {
  const id=attribution.yclid||attribution.client_id;
  if(!/^\d+$/.test(id)||!Number.isSafeInteger(row.price_milliunits)||row.price_milliunits<=0||!/^[A-Z]{3}$/.test(row.currency))throw new Error('Invalid conversion');
  return `${attribution.yclid?'Yclid':'ClientId'},Target,DateTime,Price,Currency\n${id},${PAYMENT_GOAL},${Math.floor(row.purchase_date/1000)},${row.price_milliunits/1000},${row.currency}\n`;
}

export async function flushPayments(env,{fetcher=fetch,now=Date.now()}={}) {
  const db=env.PAYMENTS_DB;
  if(!db)return {enabled:false};
  await queueFirstPayments(db,now);
  // A lost HTTP response must not automatically create a duplicate conversion.
  await db.prepare("UPDATE payment_conversions SET state='uncertain' WHERE state='sending' AND updated_at<?").bind(now-300000).run();
  if(env.PAYMENT_EXPORT_ENABLED!=='1'||!env.METRICA_OAUTH_TOKEN)return {enabled:false};
  const counter=String(env.METRICA_COUNTER_ID||'');
  if(!/^\d+$/.test(counter))throw new Error('Counter not configured');
  const pending=await db.prepare("SELECT subject_key,uploading_id FROM payment_conversions WHERE state='uploaded' LIMIT 10").all();
  for(const row of pending.results){
    try {
      const r=await fetcher(`https://api-metrika.yandex.net/management/v1/counter/${counter}/offline_conversions/uploading/${row.uploading_id}`,{headers:{Authorization:`OAuth ${env.METRICA_OAUTH_TOKEN}`},signal:AbortSignal.timeout(15000)});
      if(!r.ok)continue;
      const data=await r.json();const status=data.uploading?.status;
      if(['PROCESSED','LINKAGE_FAILURE'].includes(status))await db.prepare('UPDATE payment_conversions SET state=?,updated_at=? WHERE subject_key=? AND state=\'uploaded\'').bind(status==='PROCESSED'?'processed':'unmatched',now,row.subject_key).run();
    }catch{/* Keep the uploading ID for safe later status checks. */}
  }
  const row=await claimConversion(db,now);
  if(!row)return {enabled:true,sent:0};
  try {
    const attribution=await attributionFor(db,row.app_account_token);
    const file=new FormData();file.append('file',new Blob([conversionCsv(row,attribution)],{type:'text/csv'}),'first-payment.csv');
    const response=await fetcher(`https://api-metrika.yandex.net/management/v1/counter/${counter}/offline_conversions/upload?comment=${encodeURIComponent('WF '+row.transaction_id)}`,{method:'POST',headers:{Authorization:`OAuth ${env.METRICA_OAUTH_TOKEN}`},body:file,signal:AbortSignal.timeout(15000)});
    if(!response.ok){
      // Explicit rejection is distinguishable from an ambiguous timeout.
      const state=response.status===429&&row.attempts<5?'pending':'rejected';
      await db.prepare('UPDATE payment_conversions SET state=?,updated_at=? WHERE subject_key=?').bind(state,now,row.subject_key).run();return {enabled:true,sent:0};
    }
    const data=await response.json();const id=data.uploading?.id;
    if(!Number.isSafeInteger(id)||id<=0)throw new Error('Upload status unknown');
    await db.prepare("UPDATE payment_conversions SET state='uploaded',uploading_id=?,updated_at=? WHERE subject_key=?").bind(String(id),now,row.subject_key).run();
    return {enabled:true,sent:1};
  }catch{
    await db.prepare("UPDATE payment_conversions SET state='uncertain',updated_at=? WHERE subject_key=?").bind(now,row.subject_key).run();
    return {enabled:true,sent:0};
  }
}
