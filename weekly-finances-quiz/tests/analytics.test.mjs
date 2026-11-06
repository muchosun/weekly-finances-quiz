import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const app=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const campaignDeclaration=app.match(/^const campaign = .+;$/m)[0];
const startAnalytics=app.match(/^function startAnalytics\(\) \{[\s\S]*?^\}/m)[0];

function captureAnalytics(href) {
  const url=new URL(href),calls=[],scripts=[];
  const window={ym:(...args)=>calls.push(args)};
  const document={createElement:()=>({}),head:{append:script=>scripts.push(script)}};
  runInNewContext(`
    let analyticsEnabled=false;
    const params=new URLSearchParams(location.search);
    const config={metricaId:114081987};
    const funnelEvents=[{name:'quiz_complete',market:'US'}];
    ${campaignDeclaration}
    ${startAnalytics}
    startAnalytics();
    startAnalytics();
  `,{window,document,location:url,URL,URLSearchParams,$:()=>null});
  return {calls,scripts};
}

test('the first recorded hit retains advertising attribution without unrelated URL data',()=>{
  const incoming=new URL('https://quiz.example/');
  const tags={utm_source:'yandex',utm_medium:'cpc',utm_campaign:'US test',utm_content:'creative/one',utm_term:'weekly budget',yclid:'12345678901234567890'};
  for(const [key,value] of Object.entries(tags))incoming.searchParams.set(key,value);
  incoming.searchParams.set('income','private-amount');
  incoming.searchParams.set('email','private@example.test');
  incoming.hash='private-fragment';
  const {calls,scripts}=captureAnalytics(incoming.href);
  const hits=calls.filter(call=>call[1]==='hit');
  assert.equal(hits.length,1);
  const hitUrl=new URL(hits[0][2]);
  assert.deepEqual(Object.fromEntries(hitUrl.searchParams),tags);
  assert.equal(hitUrl.origin,'https://quiz.example');
  assert.equal(hitUrl.pathname,'/');
  assert.equal(hitUrl.hash,'');
  assert.equal(calls.filter(call=>call[1]==='init').length,1);
  assert.equal(scripts.length,1);
  const goal=calls.find(call=>call[1]==='reachGoal');
  assert.equal(goal[2],'quiz_complete');
  for(const [key,value] of Object.entries(tags))assert.equal(goal[3][key],value);
  assert.ok(calls.indexOf(hits[0])<calls.indexOf(goal));
});

test('direct visits keep their path and do not acquire fabricated campaign tags',()=>{
  const {calls}=captureAnalytics('https://quiz.example/?market=US#section');
  assert.equal(calls.find(call=>call[1]==='hit')[2],'https://quiz.example/');
});
