import { createHandler } from './worker-handler.mjs';
import { html, csp } from './build/site.mjs';
import { flushPayments } from './payments/metrica.mjs';

const handle=createHandler({html,csp});
export default { async fetch(request,env) {
  try{return await handle(request,env);}catch{
    console.error(JSON.stringify({event:'request_failed',path:new URL(request.url).pathname}));
    return Response.json({ok:false,error:'Temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}, async scheduled(controller,env,ctx) {
  ctx.waitUntil(flushPayments(env).catch(()=>console.error(JSON.stringify({event:'payment_export_failed'}))));
} };
