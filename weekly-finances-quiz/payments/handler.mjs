import { verifyApple,normalizeTransaction } from './apple.mjs';
import { recordNotification } from './ledger.mjs';

export async function appleNotification(request,env,environment,{verify=verifyApple,now=Date.now()}={}) {
  const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(request.method!=='POST')return reply(405,{ok:false});
  if(!env.PAYMENTS_DB)return reply(503,{ok:false});
  if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return reply(415,{ok:false});
  const reader=request.body?.getReader();if(!reader)return reply(400,{ok:false});
  const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>131072){await reader.cancel();return reply(413,{ok:false});}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{ok:false});}
  if(!body||Object.keys(body).some(k=>k!=='signedPayload')||typeof body.signedPayload!=='string'||body.signedPayload.length<30)return reply(400,{ok:false});
  let verified,transaction;
  try{verified=await verify(body.signedPayload,environment);transaction=normalizeTransaction(verified.notification,verified.transaction,environment,now);}catch(error){return reply(error.status===503?503:400,{ok:false});}
  // Never log or retain the raw JWS, transaction receipt, client ID, or click ID.
  await recordNotification(env.PAYMENTS_DB,verified.notification,transaction,environment,now);
  return reply(200,{ok:true});
}
