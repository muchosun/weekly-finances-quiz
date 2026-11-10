import test from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFF_STORAGE_KEY,HANDOFF_WINDOW_MS,validAppHandoff,loadAppHandoff,saveAppHandoff,appOpenUrl,analyticsAttribution } from '../dist/app-handoff.mjs';

const now=Date.now(),token='7e3fb20b-4cdb-47cc-936d-99d65f608138';
const record={version:1,token,expiresAt:now+HANDOFF_WINDOW_MS};
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}

test('reload restores the same server token without financial answers or analytics identifiers',()=>{
  const saved=storage();
  assert.equal(saveAppHandoff(saved,{...record,token:token.toUpperCase(),income:4000,clientId:'123',yclid:'456'},now),true);
  const restored=loadAppHandoff(saved,now+86400000);
  assert.deepEqual(restored,record);
  assert.deepEqual(Object.keys(JSON.parse(saved.getItem(HANDOFF_STORAGE_KEY))),['version','token','expiresAt']);
  const url=new URL(appOpenUrl(restored,now+86400000));
  assert.equal(url.origin,'https://financialplan.pistonsky.dev');
  assert.equal(url.pathname,'/open');
  assert.deepEqual(Object.fromEntries(url.searchParams),{token});
});

test('expired, corrupted and unbounded records cannot create an app-opening link',()=>{
  for(const value of [null,{...record,version:2},{...record,token:'not-a-uuid'},{...record,token:'00000000-0000-0000-0000-000000000000'},{...record,expiresAt:now},{...record,expiresAt:now+HANDOFF_WINDOW_MS+300001}]){
    assert.equal(validAppHandoff(value,now),null);
    assert.equal(appOpenUrl(value,now),null);
  }
  const saved=storage();saved.setItem(HANDOFF_STORAGE_KEY,'{broken');
  assert.equal(loadAppHandoff(saved,now),null);
  saved.setItem(HANDOFF_STORAGE_KEY,JSON.stringify({...record,expiresAt:now-1}));
  assert.equal(loadAppHandoff(saved,now),null);
  assert.equal(saved.getItem(HANDOFF_STORAGE_KEY),null);
});

test('unavailable browser storage does not prevent opening the link in the current tab',()=>{
  const blocked={setItem(){throw new Error('blocked');},getItem(){throw new Error('blocked');}};
  assert.equal(saveAppHandoff(blocked,record,now),false);
  assert.equal(loadAppHandoff(blocked,now),null);
  assert.equal(new URL(appOpenUrl(record,now)).searchParams.get('token'),token);
});

test('attribution honors analytics opt-out and permits only validated numeric IDs',()=>{
  assert.equal(analyticsAttribution({allowed:false,clientId:'123',yclid:'456'}),null);
  assert.equal(analyticsAttribution({allowed:true,clientId:'=bad',yclid:'<bad>'}),null);
  assert.equal(analyticsAttribution({allowed:true}),null);
  assert.deepEqual(analyticsAttribution({allowed:true,clientId:'123',yclid:'9876543210987654321'}),{analyticsAllowed:true,clientId:'123',yclid:'9876543210987654321'});
  assert.deepEqual(analyticsAttribution({allowed:true,clientId:'invalid',yclid:'456'}),{analyticsAllowed:true,yclid:'456'});
});
