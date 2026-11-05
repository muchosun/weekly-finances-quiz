import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

// The pinned local workerd supports dates through August 6. The production
// compatibility date stays November 5 and requires its own public smoke check.
const mf=new Miniflare({modules:true,script:await readFile('build/worker-bundle.mjs','utf8'),compatibilityDate:'2026-08-06',compatibilityFlags:['nodejs_compat'],bindings:{PUBLIC_ORIGIN:'https://quiz.example'},d1Databases:['PAYMENTS_DB']});
try{
  const config=await mf.dispatchFetch('https://quiz.example/api/config');assert.equal(config.status,200);assert.equal((await config.json()).preview,false);
  const home=await mf.dispatchFetch('https://quiz.example/');assert.equal(home.status,200);assert.match(await home.text(),/Weekly Finances/);
  const header=Buffer.from(JSON.stringify({alg:'ES256',x5c:['invalid','invalid','invalid']})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({signedDate:Date.now()})).toString('base64url');
  const forged=await mf.dispatchFetch('https://quiz.example/api/apple/notifications/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signedPayload:`${header}.${payload}.invalid-signature`})});
  assert.equal(forged.status,400);assert.deepEqual(await forged.json(),{ok:false});
  console.log('Worker runtime smoke passed: quiz, public config, lazy Apple verifier and rejection of forged notification.');
}finally{await mf.dispose();}
