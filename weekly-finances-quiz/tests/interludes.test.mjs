import test from 'node:test';
import assert from 'node:assert/strict';
import {afterQuestion,beforeQuestion,interludes,budgetSnapshot} from '../dist/interlude-model.mjs';

test('all seven questions remain in order, with insights after questions 2, 4 and 6',()=>{
  const path=[0];let screen=0;
  for(let guard=0;guard<15&&screen!=='verify';guard++){
    screen=typeof screen==='number'?afterQuestion(screen):interludes.find(item=>item.screen===screen).next;
    path.push(screen);
  }
  assert.deepEqual(path,[0,1,'insight-perspective',2,3,'insight-week',4,5,'insight-start',6,'verify']);
});
test('Back goes through the relevant insight; each insight can return to its preceding question',()=>{
  assert.equal(beforeQuestion(0),'home');
  assert.equal(beforeQuestion(2),'insight-perspective');
  assert.equal(beforeQuestion(4),'insight-week');
  assert.equal(beforeQuestion(6),'insight-start');
  assert.deepEqual(interludes.map(item=>item.after),[1,3,5]);
});
test('period switching changes every amount consistently without modifying personal figures',()=>{
  const input={income:5200,essentials:2600,savings:1300};
  const monthly=budgetSnapshot(input,'monthly');const weekly=budgetSnapshot(input,'weekly');
  assert.deepEqual([weekly.income,weekly.essentials,weekly.savings,weekly.room],[1200,600,300,300]);
  assert.deepEqual([monthly.income,monthly.essentials,monthly.savings,monthly.room],[5200,2600,1300,1300]);
  assert.deepEqual(input,{income:5200,essentials:2600,savings:1300});
});
test('the budget explorer preserves unknown values and negative room',()=>{
  assert.equal(budgetSnapshot(null),null);
  assert.equal(budgetSnapshot({income:5000,essentials:null,savings:100}),null);
  assert.ok(budgetSnapshot({income:100,essentials:200,savings:0}).room<0);
});
