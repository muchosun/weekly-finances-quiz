import { verifyCaptcha } from './captcha.mjs';
import { appleNotification } from './payments/handler.mjs';
import { createAttribution,validAttribution } from './payments/ledger.mjs';
import { smartAppBannerContent } from './dist/quiz-model.mjs';

const baseHeaders = {
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
const json=(status,data)=>Response.json(data,{status,headers:baseHeaders});

async function readToken(request) {
  const reader=request.body?.getReader();
  if(!reader)return {error:400};
  const chunks=[];let size=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>12000){await reader.cancel();return {error:413};}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{return {error:400};}
  if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(key=>!['token','attribution'].includes(key)))return {error:400};
  if(data.attribution!==undefined&&!validAttribution(data.attribution))return {error:400};
  return {token:data.token,attribution:data.attribution};
}

export function createHandler({html,csp,verify=verifyCaptcha}) {
  return async function handle(request,env) {
    const url=new URL(request.url);
    if(url.origin!==env.PUBLIC_ORIGIN)return json(403,{ok:false,error:'This host is not allowed.'});
    if(url.pathname==='/api/apple/notifications/production')return appleNotification(request,env,'Production');
    if(url.pathname==='/api/apple/notifications/sandbox')return appleNotification(request,env,'Sandbox');
    if(url.pathname==='/api/config'&&request.method==='GET')return json(200,{
      preview:false,captchaProvider:'turnstile',
      captchaReady:Boolean(env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET&&env.TURNSTILE_EXPECTED_HOST),
      captchaClientKey:env.TURNSTILE_SITE_KEY||'',
      metricaId:/^\d+$/.test(env.METRICA_COUNTER_ID||'')?Number(env.METRICA_COUNTER_ID):null,
      appStoreCampaignUrl:env.APP_STORE_CAMPAIGN_URL||'',
      paymentAttributionReady:env.PAYMENT_ATTRIBUTION_ENABLED==='1'&&Boolean(env.PAYMENTS_DB),
    });
    if(url.pathname==='/api/complete'&&request.method==='POST'){
      if(request.headers.get('Origin')!==env.PUBLIC_ORIGIN)return json(403,{ok:false,error:'This request is not allowed.'});
      if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return json(415,{ok:false,error:'Expected JSON.'});
      const data=await readToken(request);
      if(data.error)return json(data.error,{ok:false,error:'Only a verification token is accepted (maximum 12 KB).'});
      const result=await verify(data.token,{secret:env.TURNSTILE_SECRET,expectedHost:env.TURNSTILE_EXPECTED_HOST});
      // Never log the token, upstream response, request body, or financial answers.
      if(result.ok&&result.verified&&data.attribution&&env.PAYMENT_ATTRIBUTION_ENABLED==='1'&&env.PAYMENTS_DB){
        const appAccountToken=await createAttribution(env.PAYMENTS_DB,data.attribution);
        return json(result.status,{...result,appAccountToken});
      }
      return json(result.status,result);
    }
    if(url.pathname.startsWith('/api/'))return json(404,{ok:false,error:'Not found.'});
    if(!['GET','HEAD'].includes(request.method))return json(405,{ok:false,error:'Method not allowed.'});
    if(!['/','/index.html'].includes(url.pathname))return json(404,{ok:false,error:'Not found.'});
    const banner=smartAppBannerContent(url.searchParams,env.APP_STORE_CAMPAIGN_URL).replaceAll('&','&amp;');
    const page=html.replace('<meta name="apple-itunes-app" content="app-id=6756235224">',()=>`<meta name="apple-itunes-app" content="${banner}">`);
    return new Response(request.method==='HEAD'?null:page,{headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp}});
  };
}
