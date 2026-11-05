import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../worker-handler.mjs';

const origin='https://quiz.example';
const env={PUBLIC_ORIGIN:origin,TURNSTILE_SITE_KEY:'public-sitekey',TURNSTILE_SECRET:'test-only-secret',TURNSTILE_EXPECTED_HOST:'quiz.example',METRICA_COUNTER_ID:'123'};
const post=(body,headers={})=>new Request(origin+'/api/complete',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body});

test('public config exposes only public settings and never downgrades to preview',async()=>{
  const handle=createHandler({html:'page',csp:'test'});
  const response=await handle(new Request(origin+'/api/config'),env);
  const config=await response.json();
  assert.equal(config.preview,false);assert.equal(config.captchaReady,true);
  assert.equal(JSON.stringify(config).includes(env.TURNSTILE_SECRET),false);
  assert.equal((await (await handle(new Request(origin+'/api/config'),{...env,TURNSTILE_SECRET:''})).json()).captchaReady,false);
  assert.equal((await handle(new Request('https://wrong.example/'),env)).status,403);
});
test('completion rejects other origins, financial fields, oversized and invalid bodies before calling provider',async()=>{
  let calls=0;
  const handle=createHandler({verify:async()=>{calls++;throw new Error('unexpected');}});
  for(const [request,status] of [
    [post('{"token":"x"}',{Origin:'https://wrong.example'}),403],
    [post('{"token":"x"}',{'Content-Type':'text/plain'}),415],
    [post('{"token":"x","income":4000}'),400],
    [post('[]'),400],[post('{broken'),400],[post('x'.repeat(12001)),413],
  ])assert.equal((await handle(request,env)).status,status);
  assert.equal(calls,0);
});
test('live completion propagates verification failure and requires configured provider',async()=>{
  const handle=createHandler({html:'page',csp:'test'});
  assert.equal((await handle(post('{"token":"x"}'),{...env,TURNSTILE_SECRET:''})).status,503);
  const rejected=createHandler({verify:async()=>({ok:false,status:403,error:'expired'})});
  assert.equal((await rejected(post('{"token":"expired"}'),env)).status,403);
  let options;
  const approved=createHandler({verify:async(token,opts)=>{assert.equal(token,'fresh-token');options=opts;return {ok:true,status:200,verified:true};}});
  const response=await approved(post('{"token":"fresh-token"}'),env);
  assert.deepEqual(await response.json(),{ok:true,status:200,verified:true});
  assert.equal(options.expectedHost,'quiz.example');
});
