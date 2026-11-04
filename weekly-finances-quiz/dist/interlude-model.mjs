import { weeklyEstimate } from './quiz-model.mjs';

const reportUrl='https://www.federalreserve.gov/publications/2026-economic-well-being-of-us-households-in-2025-savings-investments.htm';
export const survey={
  name:'Federal Reserve · SHED 2025',
  year:2025,
  publication:'May 2026',
  fieldwork:'October 17–28, 2025',
  sample:12934,
  population:'US civilian, noninstitutionalised adults aged 18+',
  method:'Weighted, nationally representative probability-based online survey',
  reportUrl,
  methodUrl:'https://www.federalreserve.gov/publications/2026-economic-well-being-of-us-households-in-2025-description.htm',
  checkedAt:'2026-11-04',
};
export const facts={
  emergency:{percent:63, text:'of US adults said they would cover a hypothetical $400 expense with cash or its equivalent in 2025.', detail:'Cash or equivalent includes savings and a credit card paid off at the next statement.', url:reportUrl},
  reserve:{percent:55, text:'of US adults reported having an emergency fund covering three months of expenses in 2025.', detail:'A self-reported savings measure, not an assessment of your finances.', url:reportUrl},
};
export const interludes=[
  {id:'perspective',screen:'insight-perspective',after:1,next:2,image:'/assets/interlude-headspace.webp',alt:'A thoughtful woman beside rounded calendar, wallet and account illustrations.',caption:'A little perspective. A little more headspace.'},
  {id:'week',screen:'insight-week',after:3,next:4,image:'/assets/interlude-weekly-view.webp',alt:'A focused man arranging spending, savings and calendar tiles.',caption:'The same picture. A clearer rhythm.'},
  {id:'start',screen:'insight-start',after:5,next:6,image:'/assets/interlude-small-step.webp',alt:'A relaxed woman looking at a savings jar and a path of small planning steps.',caption:'One small step is a place to start.'},
];

export function afterQuestion(index){return interludes.find(item=>item.after===index)?.screen ?? (index===6?'verify':index+1);}
export function beforeQuestion(index){return interludes.find(item=>item.next===index)?.screen ?? (index===0?'home':index-1);}
export function budgetSnapshot(numbers,period='weekly'){
  const estimate=weeklyEstimate(numbers);
  if(!estimate)return null;
  const factor=period==='monthly'?1:12/52;
  return {income:numbers.income*factor,essentials:numbers.essentials*factor,savings:numbers.savings*factor,room:estimate.monthly*factor,period:period==='monthly'?'monthly':'weekly'};
}
