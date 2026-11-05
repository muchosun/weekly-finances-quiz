import { questions, markets, makePlan, storeUrl } from './quiz-model.mjs';
import { interludes, facts, survey, afterQuestion, beforeQuestion, budgetSnapshot } from './interlude-model.mjs';

const paths = {
  arrow:'M4 12h16m-6-6 6 6-6 6', back:'M20 12H4m6-6-6 6 6 6', check:'m5 12 4 4L19 6',
  wallet:'M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v2m4 5h-6v5h6m-3-2.5h.01',
  calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2m2-3v6m10-6v6M3 11h18M7 15h2m4 0h2m-8 3h2',
  flag:'M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0',
  chart:'M3 3v18h18M6 15l5-5 4 3 6-8m-5 0h5v5',
  grid:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  layers:'m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5',
  spark:'m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8z',
  clock:'M12 8v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  phone:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m2 3h6m-4 14h2',
  sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12A5 5 0 1 1 7 12a5 5 0 0 1 10 0',
  lock:'M5 10h14v11H5zm3 0V6a4 4 0 0 1 8 0v4m-4 5v2',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
const apple = '<svg viewBox="0 0 24 26" fill="currentColor" aria-hidden="true"><path d="M17.5 13.6c0-2.5 2.1-3.8 2.2-3.9-1.2-1.7-3-1.9-3.7-1.9-1.6-.2-3.1 1-3.9 1s-2-1-3.3-1c-1.7 0-3.2 1-4.1 2.4-1.7 3-.4 7.4 1.3 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.3-.8s2 .8 3.4.8 2.2-1.2 3-2.3c.9-1.3 1.3-2.6 1.4-2.7-.1 0-2.7-1-2.7-3.8ZM15 6.2c.7-.9 1.2-2.1 1.1-3.3-1 .1-2.3.7-3 1.5-.6.7-1.2 2-1.1 3.1 1.2.1 2.4-.6 3-1.3Z"/></svg>';
const $ = selector => document.querySelector(selector);
const main = $('#main');
const params = new URLSearchParams(location.search);
const staticPreview = location.protocol === 'file:' || document.querySelector('meta[name="wf-static-preview"]')?.content === 'true';
let market = markets[params.get('market')?.toUpperCase()] ? params.get('market').toUpperCase() : 'US';
let config = { preview: false, captchaReady: false };
let screen = 'home';
let answers = {};
let numberDraft = {};
let captchaId = null;
let captchaToken = '';
let renderVersion = 0;
let busy = false;
let lastChoiceAt = 0;
let insightState = {guess:null,period:'weekly',stepOpen:false};
let analyticsEnabled = false;
let appInstallDismissed = false;
const funnelEvents = [];
const allowedEvents = new Set(['quiz_view','quiz_start','quiz_step_view','quiz_answer','quiz_complete','captcha_verified','app_store_click','interlude_view','interlude_continue','interlude_skip','insight_reveal','budget_toggle']);
const campaign = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','yclid'].filter(k=>params.has(k)).map(k=>[k,params.get(k).slice(0,250)]));
const formatMoney = value => new Intl.NumberFormat(markets[market].locale,{style:'currency',currency:markets[market].currency,maximumFractionDigits:0}).format(value);

function track(name, step, card, placement) {
  if (!allowedEvents.has(name)) return;
  const event = { name, market, flow_version:'insights-v1', ...(Number.isInteger(step) ? { step: step + 1 } : {}), ...(interludes.some(item=>item.id===card)?{card}:{}), ...(['result_card','result_banner'].includes(placement)?{placement}:{}) };
  funnelEvents.push(event);
  if (analyticsEnabled && typeof window.ym === 'function') window.ym(config.metricaId,'reachGoal',name,{...event, ...campaign});
}

function syncAppInstallBanner() {
  const banner=$('#app-install-banner');
  const show=screen==='result'&&!appInstallDismissed;
  banner.hidden=!show;
  document.body.classList.toggle('has-app-install-banner',show);
  if(show){
    $('#app-install-link').href=storeUrl(market,config.appStoreCampaignUrl);
    document.body.style.setProperty('--app-install-height',`${banner.getBoundingClientRect().height}px`);
  }
}

function startAnalytics() {
  if (analyticsEnabled) return;
  analyticsEnabled = true;
  window.ym = window.ym || function(){(window.ym.a=window.ym.a||[]).push(arguments);};
  window.ym.l = Date.now();
  if(!$('#metrica-script')){const script = document.createElement('script');script.id='metrica-script';script.src='https://mc.yandex.ru/metrika/tag.js';script.async=true;document.head.append(script);}
  window.ym(config.metricaId,'init',{clickmap:false,trackLinks:false,accurateTrackBounce:true,webvisor:false,defer:true});
  window.ym(config.metricaId,'hit',location.origin+location.pathname,{title:'Weekly Finances quiz',params:campaign});
  // No financial inputs or answer values are included, including in queued events.
  for (const event of funnelEvents) window.ym(config.metricaId,'reachGoal',event.name,{...event,...campaign});
  funnelEvents.length=0;
}

function syncAnalyticsSettings() {
  $('#analytics-status').textContent=analyticsEnabled?'On. Only quiz events and campaign parameters are recorded.':'Off. You can take the whole quiz without enabling it.';
  $('#accept-analytics').hidden=analyticsEnabled;
  $('#decline-analytics').textContent=analyticsEnabled?'Turn analytics off':'Keep analytics off';
}

function navigate(next, push = true) {
  if (busy) return;
  if (captchaId !== null && window.turnstile) window.turnstile.remove(captchaId);
  captchaId = null; captchaToken = '';
  screen = next;
  if (push) history.pushState({ quizScreen: next },'',location.href);
  render();
  main.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
}

function hero() {
  return `<section class="hero fade-in"><div class="hero-copy"><span class="eyebrow">YOUR MONEY, ONE WEEK AT A TIME</span><h1>Make room for<br>a <em>calmer week.</em></h1><p>Less “where did it all go?”<br>More knowing what comes next.<br>Find a money routine that fits your life.</p><button class="primary" id="start-quiz">Find my weekly plan ${icon('arrow')}</button><div class="trust-line"><span>${icon('clock')}7 quick questions</span><span>${icon('lock')}No sign-up</span><span>Free quiz</span></div></div>
  <div class="hero-art" aria-label="Illustration of a weekly money overview with example figures"><div class="orange-slab"></div><div class="phone"><div class="phone-top"><b>9:41</b><span>▰ ▰ ▰</span></div><div class="island"></div><div class="phone-nav">This Week</div><div class="phone-date">Your Sunday reset</div><div class="checkin-card"><b>A fresh week starts here.</b><p>One check-in. A clearer picture.</p><div class="mini-button">Update This Week</div></div><div class="mini-card"><div class="label">Weekly room in your plan</div><div class="mini-amount">${formatMoney(346)}</div><div class="mini-sub">After planned bills and savings</div></div><div class="mini-card"><div class="mini-pair"><span class="label">Your weekly rhythm</span><span class="green">Looking ahead ↗</span></div><div class="mini-bars"><i style="height:36%"></i><i style="height:60%"></i><i style="height:45%"></i><i style="height:72%"></i><i style="height:65%"></i><i style="height:88%"></i><i style="height:100%"></i></div></div><div class="mini-link"><span>Upcoming bills</span><span>→</span></div><div class="mini-link"><span>Dream purchases</span><span>→</span></div><div class="home-indicator"></div></div><div class="floating-note"><span class="note-dot"></span>A small weekly habit.<b>A little more headspace.</b></div><span class="art-caption">Illustrative preview · example figures</span></div></section>
  <div class="flow-strip"><div class="flow-item"><span class="flow-num">01</span><div><b>Tell us a little about your week</b><p>Your goals, your rhythm, your starting point.</p></div></div><div class="flow-item"><span class="flow-num">02</span><div><b>Get a plan that makes sense</b><p>A practical next step based on your answers.</p></div></div><div class="flow-item"><span class="flow-num">03</span><div><b>Build your routine on iPhone</b><p>Keep going with Weekly Finances.</p></div></div></div>`;
}

function aside(current) {
  return `<aside class="quiz-aside"><span class="eyebrow">A CLEARER WEEK</span><h2>A plan around<br>your real life.</h2><p>A few small questions.<br>One useful starting point.</p><ol class="step-list">${questions.map((q,i)=>`<li class="${i<current?'done':i===current?'active':''}" ${i===current?'aria-current="step"':''}><span class="dot">${i<current?'✓':i+1}</span>${q.category}</li>`).join('')}</ol><p class="aside-caption">No bank login. No email.<br>Just a little perspective.</p></aside>`;
}

function progress(current,insight=false) {
  return `<div class="quiz-top"><button class="back-button" id="go-back" aria-label="Previous step">${icon('back')}</button><div class="progress-wrap"><div class="progress-info"><span>${insight?'A moment of perspective':current<7?questions[current].category:'Your weekly plan'}</span><span>${insight?`${current} of 7 answered`:`${Math.min(current+1,7)} of 7`}</span></div><div class="progress-track" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="7" aria-valuenow="${Math.min(current,7)}"><span style="width:${Math.min(current,7)/7*100}%"></span></div></div></div>`;
}

function factSource(){
  return `<details class="fact-source"><summary>Federal Reserve · US adults · 2025 ${icon('arrow')}</summary><p>SHED 2025 · ${survey.sample.toLocaleString('en-US')} respondents · weighted estimates for US civilian, noninstitutionalised adults aged 18+. Fieldwork: ${survey.fieldwork}. Published ${survey.publication}.</p><div><a href="${survey.reportUrl}" target="_blank" rel="noopener noreferrer">Read the finding ↗</a><a href="${survey.methodUrl}" target="_blank" rel="noopener noreferrer">Survey methods ↗</a></div></details>`;
}

function budgetMarkup(){
  const example=!budgetSnapshot(answers.numbers);
  const data=budgetSnapshot(example?{income:4000,essentials:2200,savings:300}:answers.numbers,insightState.period);
  const rows=[['income','Income'],['essentials','Planned costs'],['savings','Planned savings'],['room',data.room<0?'Gap to plan around':'Room in the plan']];
  const largest=Math.max(...rows.map(([key])=>Math.abs(data[key])));
  return `<div class="budget-context">${example?'Example figures · amounts skipped':'Your figures · in this tab'} · ${markets[market].currency}</div><div class="period-switch" role="group" aria-label="View budget by period"><button type="button" data-period="monthly" aria-pressed="${insightState.period==='monthly'}">Per month</button><button type="button" data-period="weekly" aria-pressed="${insightState.period==='weekly'}">Per week</button></div><div class="budget-rows">${rows.map(([key,label])=>`<div class="budget-row ${key==='room'?'budget-room':''} ${data[key]<0?'is-gap':''}"><div><span>${label}</span><strong>${formatMoney(data[key])}</strong></div><div class="budget-bar" aria-hidden="true"><span class="bar-${key}" style="width:${Math.abs(data[key])/largest*100}%"></span></div></div>`).join('')}</div><p class="insight-fine">Monthly × 12 ÷ 52. Rounded averages; payment dates affect cash flow.</p>`;
}

function interludeMarkup(item){
  const position=interludes.indexOf(item)+1;
  const personal={clarity:'Planned costs and savings first. Then see what remains.',bills:'Look at bill dates alongside the amounts.',dream:'Give your goal a place in the week with planned savings.',future:'Start with a weekly average, then look ahead.'}[answers.goal];
  let content;
  if(item.id==='perspective'){
    content=`<span class="eyebrow">A LITTLE PERSPECTIVE · ${position} / 3</span><h1>A small surprise can change a week.</h1><p class="interlude-intro">What share of US adults said they would pay an unexpected $400 expense with cash or its equivalent?</p><div class="guess-options" role="group" aria-label="Guess the reported share">${[43,63,83].map(value=>`<button type="button" data-guess="${value}" aria-pressed="${insightState.guess===value}">${value}<span>%</span></button>`).join('')}</div><div id="fact-reveal" class="fact-reveal" aria-live="polite" ${insightState.guess===null?'hidden':''}><div class="fact-feedback">${insightState.guess===63?'You’ve got it.':'A useful reality check.'}</div><div class="stat-number">${facts.emergency.percent}<span>%</span></div><p>${facts.emergency.text}</p><p class="insight-fine">${facts.emergency.detail}</p></div><button class="text-button reveal-fact" id="reveal-fact" ${insightState.guess!==null?'hidden':''}>Reveal the finding</button>${factSource()}`;
  }else if(item.id==='week'){
    content=`<span class="eyebrow">YOUR WEEK, IN FOCUS · ${position} / 3</span><h1>Your month.<br>A clearer weekly view.</h1><p class="interlude-intro">${personal}</p><div class="budget-explorer" id="budget-explorer" aria-live="polite">${budgetMarkup()}</div>`;
  }else{
    const plan=makePlan(answers);
    content=`<span class="eyebrow">ONE SMALL NEXT STEP · ${position} / 3</span><h1>Give your future<br>a little breathing room.</h1><div class="reserve-fact" ${insightState.stepOpen?'hidden':''}><div class="stat-number">${facts.reserve.percent}<span>%</span></div><p>${facts.reserve.text}</p><div class="people-grid" aria-hidden="true">${Array.from({length:20},(_,i)=>`<i class="${i<11?'filled':''}"></i>`).join('')}</div><span class="insight-fine">11 of 20 dots illustrate the reported 55%.</span></div>${factSource()}<button class="step-reveal-button" id="reveal-step" aria-expanded="${insightState.stepOpen}" aria-controls="first-step">${icon('spark')} ${insightState.stepOpen?'Back to the finding':'Show my first small step'} <span>＋</span></button><div class="first-step" id="first-step" ${!insightState.stepOpen?'hidden':''}><span>Suggested from your answers · Today</span><h2>${plan.steps[0].title}</h2><p>${plan.steps[0].body}</p></div>`;
  }
  return `<section class="interlude-layout fade-in ${(item.id==='perspective'&&insightState.guess!==null)||(item.id==='start'&&insightState.stepOpen)?'has-reveal':''}">${progress(item.after+1,true)}<div class="interlude-split"><div class="interlude-art"><img src="${item.image}" alt="${item.alt}" width="1120" height="840" loading="eager"><div class="art-cue">${icon('spark')}<span>${item.caption}</span></div></div><div class="interlude-content">${content}<div class="interlude-actions"><button type="button" class="text-button" id="skip-interlude">Skip this insight</button><button type="button" class="primary" id="continue-interlude">Continue ${icon('arrow')}</button></div></div></div></section>`;
}

function bindInterlude(item){
  $('#go-back').onclick=()=>navigate(item.after);
  const leave=skip=>{track(skip?'interlude_skip':'interlude_continue',undefined,item.id);lastChoiceAt=Date.now();navigate(item.next);};
  $('#skip-interlude').onclick=()=>leave(true);
  $('#continue-interlude').onclick=()=>leave(false);
  if(item.id==='perspective'){
    const reveal=value=>{
      insightState.guess=value;
      $('.interlude-layout').classList.add('has-reveal');
      document.querySelectorAll('[data-guess]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.guess)===value)));
      $('#fact-reveal').hidden=false;$('#reveal-fact').hidden=true;
      $('.fact-feedback').textContent=value===63?'You’ve got it.':'A useful reality check.';
      track('insight_reveal',undefined,item.id);
    };
    document.querySelectorAll('[data-guess]').forEach(button=>button.onclick=()=>reveal(Number(button.dataset.guess)));
    $('#reveal-fact').onclick=()=>reveal('revealed');
  }else if(item.id==='week'){
    const bindPeriods=()=>document.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=>{
      insightState.period=button.dataset.period;
      $('#budget-explorer').innerHTML=budgetMarkup();bindPeriods();
      document.querySelector(`[data-period="${insightState.period}"]`).focus({preventScroll:true});
      track('budget_toggle',undefined,item.id);
    });bindPeriods();
  }else{
    $('#reveal-step').onclick=()=>{
      insightState.stepOpen=!insightState.stepOpen;
      $('#first-step').hidden=!insightState.stepOpen;
      $('.reserve-fact').hidden=insightState.stepOpen;
      $('.interlude-layout').classList.toggle('has-reveal',insightState.stepOpen);
      $('#reveal-step').innerHTML=`${icon('spark')} ${insightState.stepOpen?'Back to the finding':'Show my first small step'} <span>＋</span>`;
      $('#reveal-step').setAttribute('aria-expanded',String(insightState.stepOpen));
      if(insightState.stepOpen)track('insight_reveal',undefined,item.id);
    };
  }
}

function numbersMarkup() {
  const fields = [['income','Take-home income','After tax, in a typical month.'],['essentials','Bills & committed spending','Rent, food, repayments and other planned costs.'],['savings','Planned savings','Money you want to set aside each month.']];
  return `<form id="money-form" class="ym-disable-submit" novalidate><div class="money-fields">${fields.map(([key,label,help],i)=>`<div class="money-field"><label for="${key}"><span>${label}<small id="${key}-help">${help}</small></span><span class="input-wrap"><span aria-hidden="true">${markets[market].symbol}</span><input class="ym-disable-keys" type="number" inputmode="decimal" enterkeyhint="${i===2?'done':'next'}" id="${key}" name="${key}" min="0" max="1000000000000" step="any" required autocomplete="off" aria-describedby="${key}-help" placeholder="—" value="${numberDraft[key] ?? answers.numbers?.[key] ?? ''}"><span class="input-error-icon" aria-hidden="true" hidden>!</span></span></label><span id="${key}-error" class="sr-only"></span></div>`).join('')}</div><p class="field-note">Monthly amounts in ${markets[market].currency} · estimates are fine. Use 0 for no bills or savings. For illustration only.</p><p class="sr-only" id="number-error" role="alert"></p><div class="question-actions"><button type="button" class="text-button" id="skip-numbers">Skip for now</button><button type="submit" class="primary">Continue ${icon('arrow')}</button></div></form>`;
}

function questionMarkup(index) {
  const q = questions[index];
  return `<div class="quiz-layout">${aside(index)}<section class="question fade-in">${progress(index)}<div class="question-icon">${icon(q.icon)}</div><h1>${q.title}</h1><p class="question-subtitle">${q.subtitle}</p>${q.type === 'numbers' ? numbersMarkup() : `<div class="options" role="group" aria-label="${q.title}" aria-describedby="choice-help">${q.options.map(([value,label,help,ic])=>`<button class="option" type="button" data-answer="${value}" aria-pressed="${answers[q.id]===value}"><span class="option-icon">${icon(ic)}</span><span class="option-copy"><b>${label}</b><small>${help}</small></span><span class="choice-circle">${icon('check')}</span></button>`).join('')}</div><p class="field-note" id="choice-help">Tap an answer to continue. You can go back.</p>`}</section></div>`;
}

function verifyMarkup() {
  return `<div class="quiz-layout">${aside(7)}<section class="question fade-in">${progress(7)}<div class="question-icon">${icon('check')}</div><h1>Your weekly plan is ready.</h1><p class="question-subtitle">One quick check, then explore your routine.</p><div class="verification"><h2>${config.preview?'Your plan preview is ready':'One quick check'}</h2>${config.preview?'<p class="preview-note">This is a design preview. Cloudflare Turnstile is not connected, and no human verification has taken place.</p>':config.captchaReady?'<p>Complete the Cloudflare Turnstile check to see your personalised plan.</p><div id="captcha-container" class="captcha-container"></div>':'<p>Verification is temporarily unavailable. Your answers remain in this tab. Please try again later.</p>'}<p id="captcha-error" class="error" role="alert" hidden></p><button id="show-plan" class="primary" ${!config.preview?'disabled':''}>${config.preview?'View preview plan':'Show my weekly plan'} ${icon('arrow')}</button></div><p class="field-note">No account is created. Optional amounts stay in your browser tab.</p></section></div>`;
}

function resultMarkup() {
  const plan = makePlan(answers);
  const estimate = plan.estimate;
  const negative = estimate?.weekly < 0;
  const amountPanel = estimate ? `<div class="estimate-card"><span class="eyebrow">${negative?'A GAP TO PLAN AROUND':'YOUR ILLUSTRATIVE WEEKLY ROOM'}</span><div class="estimate-amount">${formatMoney(Math.abs(estimate.weekly))}<small> / week</small></div><p>${negative?'Your planned monthly costs and savings exceed the income you entered. Review commitments before setting a spending target.':`After the monthly bills and savings you entered. This does not account for payment timing or costs you have not included.`}</p><p style="margin-top:10px">(${formatMoney(answers.numbers.income)} − ${formatMoney(answers.numbers.essentials)} − ${formatMoney(answers.numbers.savings)}) × 12 ÷ 52. Monthly averages, not a cash-flow forecast.</p></div>` : `<div class="estimate-card"><span class="eyebrow">YOUR STARTING POINT</span><div class="estimate-amount" style="font-size:31px;letter-spacing:-1px">One week at a time.</div><p>You skipped the amounts. Start with a balance snapshot, then add planned income and expenses when you are ready.</p></div>`;
  return `<section class="result-layout fade-in"><div class="result-heading"><div class="result-check">${icon('check')}</div><span class="eyebrow">YOUR PERSONALISED STARTING POINT</span><h1>${plan.name}</h1><p>${plan.line}</p></div><div class="result-grid"><div class="plan-card"><h2>Your next three small steps</h2><p class="plan-why">${plan.why}</p>${plan.steps.map((step,i)=>`<div class="plan-step"><span class="step-number">${i+1}</span><div><small>${step.when}</small><h3>${step.title}</h3><p>${step.body}</p></div></div>`).join('')}</div><div>${amountPanel}<div class="store-card"><div class="store-brand"><img src="/assets/app-icon.webp" alt=""><div><b>Weekly Finances</b><small>Weekly money planning for iPhone</small></div></div><p>Bring this routine into your week. Track balances, plan recurring expenses and look ahead in one place.</p><a class="primary" id="app-store-link" href="${storeUrl(market,config.appStoreCampaignUrl)}" target="_blank" rel="noopener noreferrer">${apple}Get Weekly Finances ${icon('arrow')}</a><p class="price-note">Free to download · Optional Premium subscription.</p><p class="price-note">${market==='US'?'US App Store lists $1.99/month or $19.99/year. Prices and terms shown by Apple at purchase apply.':'Local availability, prices and subscription terms are shown in your App Store.'}</p><p class="price-note">Your quiz answers do not transfer to the app. Set up your plan after installing.</p></div></div></div><div class="result-foot"><button class="text-button" id="start-again">Start again</button><p>A suggested routine based on your answers, not a financial assessment. Estimates use the figures you entered. Results are not guaranteed.</p></div></section>`;
}

function bindQuestion(index) {
  const q = questions[index];
  $('#go-back').onclick = () => navigate(beforeQuestion(index));
  if (q.type === 'numbers') {
    const fields=['income','essentials','savings'].map(key=>$('#'+key));
    const issue=input=>{
      const raw=input.value.trim(), value=Number(raw);
      if(input.validity.badInput)return 'Enter a monthly amount using numbers.';
      if(!raw)return 'Add an amount, or skip this step.';
      if(!Number.isFinite(value)||value<0||value>1e12)return 'Use an amount from 0 to 1 trillion.';
      if(input.id==='income'&&value===0)return 'Income must be above 0, or skip this step.';
      return '';
    };
    const mark=(input,message,shake=false)=>{
      const wrap=input.closest('.input-wrap');
      input.setAttribute('aria-invalid',String(Boolean(message)));
      input.setAttribute('aria-describedby',`${input.id}-help${message?' '+input.id+'-error':''}`);
      $('#'+input.id+'-error').textContent=message;
      wrap.classList.toggle('is-invalid',Boolean(message));
      wrap.querySelector('.input-error-icon').hidden=!message;
      if(shake&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        wrap.getAnimations().forEach(animation=>animation.cancel());
        wrap.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(4px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:280,easing:'ease-out'});
      }
    };
    fields.forEach((input,i)=>{
      input.oninput=()=>{numberDraft[input.id]=input.value;if(input.getAttribute('aria-invalid')==='true'&&!issue(input))mark(input,'');};
      input.onblur=()=>{if(input.value||input.validity.badInput)mark(input,issue(input));};
      input.onkeydown=e=>{if(e.key==='Enter'&&i<fields.length-1){e.preventDefault();fields[i+1].focus();}};
    });
    $('#skip-numbers').onclick=()=>{answers.numbers=null;track('quiz_answer',index);navigate(afterQuestion(index));};
    $('#money-form').onsubmit=e=>{
      e.preventDefault();
      const invalid=fields.filter(input=>Boolean(issue(input)));
      fields.forEach(input=>mark(input,issue(input),invalid.includes(input)));
      if(invalid.length){
        $('#number-error').textContent=`${invalid.length} ${invalid.length===1?'amount needs':'amounts need'} attention. ${issue(invalid[0])}`;
        invalid[0].focus({preventScroll:true});invalid[0].scrollIntoView({block:'nearest',behavior:'auto'});return;
      }
      answers.numbers=Object.fromEntries(fields.map(input=>[input.id,Number(input.value)]));
      track('quiz_answer',index);navigate(afterQuestion(index));
    };
  } else {
    let advancing = false;
    const version = renderVersion;
    document.querySelectorAll('[data-answer]').forEach(button=>button.onclick=()=>{
      if (advancing || Date.now() - lastChoiceAt < 350) return;
      advancing = true;
      lastChoiceAt = Date.now();
      answers[q.id]=button.dataset.answer;
      document.querySelectorAll('[data-answer]').forEach(b=>{b.setAttribute('aria-pressed',String(b===button));b.disabled=true;});
      track('quiz_answer',index);
      // Brief selection feedback; ignore a second tap and stale transitions after Back.
      setTimeout(()=>{if(screen===index && renderVersion===version)navigate(afterQuestion(index));},140);
    });
  }
}

let captchaScriptPromise;
async function mountCaptcha(version) {
  if (config.preview || !config.captchaReady) return;
  const showError = message => {
    if(screen!=='verify'||version!==renderVersion)return;
    captchaToken='';$('#show-plan').disabled=true;
    $('#captcha-error').hidden=false;$('#captcha-error').textContent=message;
  };
  try {
    if (!window.turnstile) {
      captchaScriptPromise ||= new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
        script.onload=resolve;script.onerror=()=>{captchaScriptPromise=null;script.remove();reject(new Error('load'));};document.head.append(script);
      });
      await captchaScriptPromise;
    }
    if(screen!=='verify'||version!==renderVersion)return;
    captchaId=window.turnstile.render('#captcha-container',{
      sitekey:config.captchaClientKey,action:'quiz_complete',theme:'dark',language:'en',size:'compact',
      callback:token=>{if(screen!=='verify'||version!==renderVersion)return;captchaToken=token;$('#show-plan').disabled=!token;$('#captcha-error').hidden=true;},
      'expired-callback':()=>showError('Your check expired. Please complete it again.'),
      'timeout-callback':()=>showError('The check timed out. Please try again.'),
      'error-callback':()=>{showError('Verification could not load. Please check your connection and try again.');return true;},
    });
  } catch {showError('Verification could not load. Check your connection and try again.');}
}

async function complete() {
  if(busy||(!config.preview&&!captchaToken))return;
  if (staticPreview && config.preview) { track('quiz_complete');navigate('result');return; }
  busy=true;const button=$('#show-plan');button.disabled=true;button.textContent='Preparing your plan…';
  try {
    const response=await fetch('/api/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:captchaToken}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if(!response.ok||!result.ok||(!config.preview&&result.verified!==true))throw new Error(result.error||'Verification failed. Please try again.');
    if(result.verified)track('captcha_verified');
    track('quiz_complete');busy=false;navigate('result');
  } catch(error) {
    if (screen !== 'verify') { busy=false;return; }
    $('#captcha-error').hidden=false;$('#captcha-error').textContent=error.name==='TimeoutError'?'The check timed out. Please try again.':error.message;
    captchaToken='';if(captchaId!==null)window.turnstile?.reset(captchaId);
    button.textContent=config.preview?'View preview plan':'Show my weekly plan';button.disabled=!config.preview;busy=false;
  }
}

function render() {
  renderVersion++;
  document.body.dataset.screen=typeof screen==='number'?'question':screen;
  $('.market-control').hidden=screen!=='home';$('#locked-market').hidden=screen==='home';$('#locked-market').textContent=markets[market].currency;
  if (screen==='home') {main.innerHTML=hero();$('#start-quiz').onclick=()=>{track('quiz_start');navigate(0);};}
  else if(interludes.some(item=>item.screen===screen)){const item=interludes.find(item=>item.screen===screen);main.innerHTML=interludeMarkup(item);bindInterlude(item);track('interlude_view',undefined,item.id);}
  else if (screen==='verify') {main.innerHTML=verifyMarkup();$('#go-back').onclick=()=>navigate(6);$('#show-plan').onclick=complete;mountCaptcha(renderVersion);}
  else if (screen==='result') {
    main.innerHTML=resultMarkup();
    $('#app-store-link').onclick=()=>{track('app_store_click',undefined,undefined,'result_card');appInstallDismissed=true;syncAppInstallBanner();};
    $('#start-again').onclick=()=>{answers={};numberDraft={};insightState={guess:null,period:'weekly',stepOpen:false};navigate('home');};
  } else {main.innerHTML=questionMarkup(screen);bindQuestion(screen);track('quiz_step_view',screen);}
  syncAppInstallBanner();
}

$('#dismiss-app-install').onclick=()=>{appInstallDismissed=true;syncAppInstallBanner();main.focus({preventScroll:true});};
$('#app-install-link').onclick=()=>{track('app_store_click',undefined,undefined,'result_banner');appInstallDismissed=true;syncAppInstallBanner();};
window.addEventListener('resize',syncAppInstallBanner);
$('#market').value=market;
$('#market').onchange=e=>{market=e.target.value;answers={};numberDraft={};insightState={guess:null,period:'weekly',stepOpen:false};const url=new URL(location.href);url.searchParams.set('market',market);history.replaceState({quizScreen:'home'},'',url);render();};
$('#privacy-button').onclick=()=>$('#privacy-dialog').showModal();
$('.dialog-close').onclick=()=>$('#privacy-dialog').close();
$('.brand').onclick=e=>{e.preventDefault();if(busy)return;answers={};numberDraft={};insightState={guess:null,period:'weekly',stepOpen:false};navigate('home');};
window.addEventListener('popstate',e=>{
  if (busy) { history.pushState({quizScreen:screen},'',location.href); return; }
  let next=e.state?.quizScreen ?? 'home';
  if(next!=='home' && !answers.goal)next='home';
  navigate(next,false);
});
history.replaceState({quizScreen:'home'},'',location.href);

try {
  if(staticPreview)throw new Error('static preview');
  const response=await fetch('/api/config',{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error();config=await response.json();
} catch {config={preview:staticPreview,captchaReady:false};}
$('#preview-banner').hidden=!config.preview;
if (config.metricaId && !config.preview) {
  let preference;try{preference=localStorage.getItem('wf-analytics-consent');}catch{}
  if(preference==='allow')startAnalytics();
  $('#analytics-settings').hidden=false;syncAnalyticsSettings();
  $('#accept-analytics').onclick=()=>{try{localStorage.setItem('wf-analytics-consent','allow');}catch{}startAnalytics();syncAnalyticsSettings();};
  $('#decline-analytics').onclick=()=>{
    try{localStorage.setItem('wf-analytics-consent','decline');}catch{}
    if(analyticsEnabled){analyticsEnabled=false;window.ym?.(config.metricaId,'destruct');funnelEvents.length=0;}
    syncAnalyticsSettings();$('#privacy-dialog').close();
  };
}
track('quiz_view');render();
