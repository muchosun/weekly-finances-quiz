import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyCaptcha } from './captcha.mjs';

const port=Number(process.env.PORT||4317);
const host=process.env.HOST||'127.0.0.1';
const origin=process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${port}`;
const preview=process.env.PREVIEW_MODE!=='0' && process.env.NODE_ENV!=='production' && ['127.0.0.1','::1','localhost'].includes(host) && ['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname);
const clientKey=process.env.SMARTCAPTCHA_CLIENT_KEY||'';
const secret=process.env.SMARTCAPTCHA_SERVER_KEY||'';
const expectedHost=process.env.SMARTCAPTCHA_EXPECTED_HOST||'';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.webp':'image/webp'};
const headers={ 'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self' https://smartcaptcha.cloud.yandex.ru https://captcha-api.yandex.ru https://mc.yandex.ru; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://mc.yandex.ru https://*.yandex.ru; connect-src 'self' https://smartcaptcha.cloud.yandex.ru https://captcha-api.yandex.ru https://mc.yandex.ru https://mc.yandex.com; frame-src https://smartcaptcha.cloud.yandex.ru https://captcha-api.yandex.ru; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" };

function json(res,status,data){res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,origin);
    if(req.method==='GET' && url.pathname==='/api/config') return json(res,200,{
      preview,captchaReady:Boolean(clientKey&&secret&&expectedHost),captchaClientKey:clientKey,
      metricaId:/^\d+$/.test(process.env.METRICA_COUNTER_ID||'')?Number(process.env.METRICA_COUNTER_ID):null,
      appStoreCampaignUrl:process.env.APP_STORE_CAMPAIGN_URL||'',
    });
    if(req.method==='POST' && url.pathname==='/api/complete'){
      if(req.headers.origin!==origin)return json(res,403,{ok:false,error:'This request is not allowed.'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{ok:false,error:'Expected JSON.'});
      let body='';
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000)return json(res,413,{ok:false,error:'Request too large.'});}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{ok:false,error:'Invalid request.'});}
      if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(k=>k!=='token'))return json(res,400,{ok:false,error:'Only a verification token is accepted.'});
      if(preview)return json(res,200,{ok:true,verified:false,preview:true});
      const result=await verifyCaptcha(data.token,{secret,expectedHost});
      return json(res,result.status,result);
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
    let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Invalid path.'});}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||pathname.split('/').some(part=>part.startsWith('.')))return json(res,404,{error:'Not found.'});
    const content=await readFile(file);
    res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);
  } catch(error){if(error.code==='ENOENT'||error.code==='EISDIR')return json(res,404,{error:'Not found.'});json(res,500,{error:'Unexpected server error.'});}
});
server.listen(port,host,()=>{console.log(`Weekly Finances: http://${host}:${port}`);console.log(preview?'Mode: local design preview. CAPTCHA not verified.':'Mode: live. CAPTCHA validation required.');});
