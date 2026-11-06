import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const app=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
const campaignDeclaration=app.match(/^const campaign = .+;$/m)[0];
const startAnalytics=app.match(/^function startAnalytics\(\) \{[\s\S]*?^\}/m)[0];
const track=app.match(/^function track\(.*\) \{[\s\S]*?^\}/m)[0];
const sendAnalyticsEvent=app.match(/^function sendAnalyticsEvent\(.*\) \{[\s\S]*?^\}/m)[0];
const allowedEvents=app.match(/^const allowedEvents = .+;$/m)[0];

function captureAnalytics(href,{beforeStart='',afterStart=''}={}) {
  const url=new URL(href),calls=[],scripts=[];
  const window={ym:(...args)=>calls.push(args)};
  const document={createElement:()=>({}),head:{append:script=>scripts.push(script)}};
  runInNewContext(`
    let analyticsEnabled=false;
    const params=new URLSearchParams(location.search);
    const config={metricaId:114081987};
    const market='US';
    const questions=Array(7);
    const interludes=[{id:'perspective'},{id:'week'},{id:'start'}];
    const funnelEvents=[{name:'quiz_complete',market:'US'}];
    ${campaignDeclaration}
    ${allowedEvents}
    ${sendAnalyticsEvent}
    ${track}
    ${startAnalytics}
    ${beforeStart}
    startAnalytics();
    startAnalytics();
    ${afterStart}
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

test('every question has its own goal, including queued views before analytics starts',()=>{
  const {calls}=captureAnalytics('https://quiz.example/?utm_source=qa&utm_campaign=funnel&yclid=12345678901234567890',{
    beforeStart:"track('quiz_step_view',0);",
    afterStart:"for(let step=1;step<7;step++)track('quiz_step_view',step);"
  });
  const views=calls.filter(call=>call[1]==='reachGoal'&&/^quiz_step_\d+_view$/.test(call[2]));
  assert.deepEqual(views.map(call=>call[2]),Array.from({length:7},(_,i)=>`quiz_step_${i+1}_view`));
  for(const [i,call] of views.entries()){
    assert.equal(call[3].step,i+1);
    assert.equal(call[3].utm_campaign,'funnel');
    assert.equal(call[3].yclid,'12345678901234567890');
  }
  assert.equal(calls.filter(call=>call[2]==='quiz_step_view').length,7);
  assert.ok(calls.findIndex(call=>call[1]==='hit')<calls.indexOf(views[0]));
});

test('insights, verification and final events stay distinguishable without answer values',()=>{
  const {calls}=captureAnalytics('https://quiz.example/?utm_source=qa&income=private&email=private@example.test',{
    afterStart:"for(const card of ['perspective','week','start'])track('interlude_view',undefined,card);track('quiz_verify_view');track('quiz_complete');track('app_store_click',undefined,undefined,'result_card');"
  });
  const goals=calls.filter(call=>call[1]==='reachGoal');
  for(const name of ['quiz_insight_1_view','quiz_insight_2_view','quiz_insight_3_view','quiz_verify_view','app_store_click'])assert.equal(goals.filter(call=>call[2]===name).length,1);
  assert.equal(goals.find(call=>call[2]==='app_store_click')[3].placement,'result_card');
  assert.ok(!JSON.stringify(calls).includes('private'));
});

test('invalid events and question indices do not create arbitrary funnel goals',()=>{
  const {calls}=captureAnalytics('https://quiz.example/',{
    afterStart:"track('unapproved_event');track('quiz_step_view',-1);track('quiz_step_view',7);track('interlude_view',undefined,'unknown');"
  });
  assert.ok(!calls.some(call=>call[2]==='unapproved_event'));
  assert.ok(!calls.some(call=>/^quiz_step_\d+_view$/.test(call[2]||'')));
  assert.ok(!calls.some(call=>/^quiz_insight_\d+_view$/.test(call[2]||'')));
});
