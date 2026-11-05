import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyEstimate, makePlan, storeUrl } from '../dist/quiz-model.mjs';
import { verifyCaptcha } from '../captcha.mjs';

test('uses 52 weeks, preserves a deficit, and treats skipped data as unknown',()=>{
  assert.equal(weeklyEstimate({income:4000,essentials:2200,savings:300}).weekly,1500*12/52);
  assert.ok(weeklyEstimate({income:100,essentials:200,savings:0}).weekly<0);
  assert.equal(weeklyEstimate(null),null);
  assert.equal(weeklyEstimate({income:100,essentials:null,savings:0}),null);
  assert.equal(weeklyEstimate({income:0,essentials:0,savings:0}),null);
  assert.equal(weeklyEstimate({income:Infinity,essentials:0,savings:0}),null);
});
test('different goals and constraints produce different actionable plans',()=>{
  const bills=makePlan({goal:'bills',friction:'surprises',pay:'variable',accounts:'many',routine:'sunday'});
  const dream=makePlan({goal:'dream',friction:'logging',pay:'weekly',accounts:'few',routine:'monday'});
  assert.notEqual(bills.name,dream.name);
  assert.match(bills.steps[1].body,/confirmed income/);
  assert.match(bills.steps[0].title,/one view/);
  assert.match(dream.steps[1].body,/dream purchase/);
  assert.match(dream.why,/balance updates/);
  assert.equal(bills.review,'Every Sunday');
  assert.equal(dream.review,'Every Monday');
});
test('App Store links stay on this app and do not invent attribution IDs',()=>{
  assert.equal(storeUrl('KZ'),'https://apps.apple.com/kz/app/weekly-finances/id6756235224');
  assert.match(storeUrl('US','javascript:alert(1)'),/^https:\/\/apps.apple.com\/us\//);
  assert.match(storeUrl('US','https://evil.test/id6756235224'),/^https:\/\/apps.apple.com\/us\//);
  assert.match(storeUrl('US','https://apps.apple.com/us/app/id999'),/6756235224$/);
  const official='https://apps.apple.com/app/id6756235224?pt=123&ct=official-campaign&mt=8';
  assert.equal(storeUrl('US',official),official);
});
test('CAPTCHA fails closed on missing configuration, missing token, outage, host mismatch and expired token',async()=>{
  assert.equal((await verifyCaptcha('sufficient-token')).status,503);
  const base={secret:'test-only-secret',expectedHost:'quiz.example'};
  assert.equal((await verifyCaptcha('',base)).status,400);
  for(const data of [{success:false,hostname:'quiz.example',action:'quiz_complete'},{success:true,hostname:'another.example',action:'quiz_complete'},{success:true,hostname:'quiz.example',action:'wrong_action'},{success:true,hostname:'',action:'quiz_complete'}]){
    const result=await verifyCaptcha('sufficient-token',{...base,fetcher:async()=>({ok:true,json:async()=>data})});
    assert.equal(result.ok,false);assert.equal(result.status,403);
  }
  assert.equal((await verifyCaptcha('sufficient-token',{...base,fetcher:async()=>({ok:false})})).status,503);
  assert.equal((await verifyCaptcha('sufficient-token',{...base,fetcher:async()=>{throw new Error('offline')}})).status,503);
});
test('Turnstile sends the token only to Cloudflare and requires the exact hostname and action',async()=>{
  let call;
  const result=await verifyCaptcha('sufficient-token',{secret:'test-only-secret',expectedHost:'quiz.example',fetcher:async(url,options)=>{
    call={url,options};return {ok:true,json:async()=>({success:true,hostname:'quiz.example',action:'quiz_complete'})};
  }});
  assert.equal(result.verified,true);
  assert.equal(call.url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(call.options.body.get('response'),'sufficient-token');
  assert.equal(call.options.body.get('secret'),'test-only-secret');
  assert.equal(call.options.body.has('income'),false);
});
