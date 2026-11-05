export const markets = {
  US: { name: 'United States', currency: 'USD', symbol: '$', store: 'us', locale: 'en-US' },
  GB: { name: 'United Kingdom', currency: 'GBP', symbol: '£', store: 'gb', locale: 'en-GB' },
  DE: { name: 'Germany', currency: 'EUR', symbol: '€', store: 'de', locale: 'en-IE' },
  KZ: { name: 'Kazakhstan', currency: 'KZT', symbol: '₸', store: 'kz', locale: 'en-US' },
  UZ: { name: 'Uzbekistan', currency: 'UZS', symbol: 'soʻm', store: 'uz', locale: 'en-US' },
};

export const questions = [
  { id: 'goal', category: 'Your focus', title: 'What would make money easier?', subtitle: 'Start with the thing that matters most to you.', icon: 'spark', options: [
    ['clarity', 'Know what I can spend', 'Less second-guessing, more clarity.', 'wallet'],
    ['bills', 'Stay ahead of my bills', 'See what is coming before it arrives.', 'calendar'],
    ['dream', 'Make room for a goal', 'Turn a someday purchase into a plan.', 'flag'],
    ['future', 'See the bigger picture', 'Understand where my money is heading.', 'chart'],
  ] },
  { id: 'habit', category: 'Your starting point', title: 'How do you track your money?', subtitle: 'There is no right answer. Just your starting point.', icon: 'wallet', options: [
    ['mental', 'Mostly in my head', 'I check my balance and make a judgement call.', 'spark'],
    ['bank', 'Through my banking apps', 'The numbers are there, but the plan is not.', 'wallet'],
    ['sheet', 'A spreadsheet or notes', 'It works, until keeping it updated gets in the way.', 'grid'],
    ['app', 'Another budgeting app', 'I am looking for a routine that fits me better.', 'phone'],
  ] },
  { id: 'pay', category: 'Your rhythm', title: 'How often do you get paid?', subtitle: 'Your plan should fit your paydays.', icon: 'calendar', options: [
    ['weekly', 'Every week', 'A regular weekly payday.', 'calendar'],
    ['biweekly', 'Every two weeks', 'A payday every other week.', 'calendar'],
    ['monthly', 'Once or twice a month', 'One or two planned paydays each month.', 'calendar'],
    ['variable', 'It varies', 'Freelance work, projects or changing income.', 'chart'],
  ] },
  { id: 'numbers', category: 'A little perspective', title: 'What does a typical month look like?', subtitle: 'Add estimates, or skip. Amounts stay in this tab.', icon: 'chart', type: 'numbers' },
  { id: 'accounts', category: 'Your money picture', title: 'How many balances do you track?', subtitle: 'Think cash, cards, savings and loan accounts.', icon: 'grid', options: [
    ['few', 'One or two', 'A simple starting point.', 'wallet'],
    ['several', 'Three to five', 'A few moving parts to bring together.', 'grid'],
    ['many', 'Six or more', 'I would like to see everything in one place.', 'layers'],
  ] },
  { id: 'friction', category: 'Your sticking point', title: 'What gets in the way most?', subtitle: 'We will make this the first thing your routine addresses.', icon: 'spark', options: [
    ['logging', 'Logging every little purchase', 'I lose momentum when tracking becomes a chore.', 'clock'],
    ['surprises', 'Expenses I did not see coming', 'Bills and planned payments catch me off guard.', 'calendar'],
    ['split', 'Money spread across accounts', 'It is hard to see the whole picture.', 'layers'],
    ['planning', 'Not knowing what comes next', 'I can see today, but not further ahead.', 'chart'],
  ] },
  { id: 'routine', category: 'Make it yours', title: 'When could you check in weekly?', subtitle: 'Pick a rhythm you can imagine keeping.', icon: 'clock', options: [
    ['sunday', 'A Sunday reset', 'A moment to get ready for the week ahead.', 'sun'],
    ['monday', 'A Monday fresh start', 'Begin the week with a clear picture.', 'calendar'],
    ['payday', 'Around payday', 'Check in when money arrives, then review weekly.', 'wallet'],
    ['flexible', 'I will find my own rhythm', 'A flexible weekly moment works best.', 'clock'],
  ] },
];

export function weeklyEstimate(numbers) {
  if (!numbers) return null;
  const { income, essentials, savings } = numbers;
  if (![income, essentials, savings].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12)) return null;
  if (income === 0) return null;
  return { monthly: income - essentials - savings, weekly: (income - essentials - savings) * 12 / 52 };
}

export function makePlan(answers = {}) {
  const goals = {
    clarity: { name: 'The weekly clarity plan', line: 'A clearer view of today. A calmer way to plan your week.', feature: 'Weekly balance check-ins', action: 'Update your balances and compare the week with your plan.' },
    bills: { name: 'The stay-ahead plan', line: 'Give upcoming bills a place in your week.', feature: 'A calendar for what is coming', action: 'Add recurring income and expenses, then review the next seven days.' },
    dream: { name: 'The make-it-happen plan', line: 'Bring your next goal into the picture, one week at a time.', feature: 'Dream purchase planning', action: 'Add one dream purchase and explore its estimated affordability date.' },
    future: { name: 'The bigger-picture plan', line: 'Connect this week’s choices with the road ahead.', feature: 'Balance and net worth forecasts', action: 'Add planned income and expenses, then explore your forecast.' },
  };
  const goal = goals[answers.goal] || goals.clarity;
  const setup = answers.accounts === 'many' ? 'Bring your accounts into one view' : answers.accounts === 'several' ? 'Start with your everyday accounts' : 'Start with one account';
  const why = {
    logging: 'You said detailed tracking gets in the way. Start with balance updates instead of a transaction-by-transaction routine.',
    surprises: 'You said expenses catch you off guard. Put recurring bills into your calendar before reviewing the week.',
    split: 'You said your money feels scattered. Bring the balances you watch into one picture first.',
    planning: 'You said looking ahead is difficult. Add known future income and expenses before exploring your forecast.',
  }[answers.friction] || 'Build your routine around a clear picture of the week ahead.';
  const habit = { mental: 'Move from a mental estimate to one written snapshot.', bank: 'Use your banking apps to check balances, then bring the overview together.', sheet: 'Use your current notes as a starting point for your account balances.', app: 'Start small and see whether a weekly rhythm feels easier to keep.' }[answers.habit] || '';
  const pay = answers.pay === 'variable' ? 'Use confirmed income in your plan. Keep uncertain payments separate.' : answers.pay === 'biweekly' ? 'Add each payday to your calendar, including the weeks between paydays.' : answers.pay === 'weekly' ? 'Add your regular payday, then review the week’s planned expenses.' : 'Add your paydays and recurring bills, including the weeks between them.';
  const review = { sunday: 'Every Sunday', monday: 'Every Monday', payday: 'After payday, then weekly', flexible: 'At your weekly check-in' }[answers.routine] || 'Each week';
  return { ...goal, why, review, estimate: weeklyEstimate(answers.numbers), steps: [
    { when: 'Today', title: setup, body: `${habit} Add balances from the same day.` },
    { when: 'This week', title: answers.friction === 'surprises' ? 'Put upcoming bills on the calendar' : goal.feature, body: `${goal.action} ${pay}` },
    { when: review, title: 'Check, compare, adjust', body: 'Update your balances, compare actual spending with your plan, and look at what is coming next.' },
  ] };
}

export function storeUrl(market, officialCampaignUrl = '') {
  const m = markets[market] || markets.US;
  if (officialCampaignUrl) {
    try {
      const u = new URL(officialCampaignUrl);
      if (u.protocol === 'https:' && u.hostname === 'apps.apple.com' && /\/id6756235224(?:\/|$)/.test(u.pathname)) return u.href;
    } catch {}
  }
  return `https://apps.apple.com/${m.store}/app/weekly-finances/id6756235224`;
}

// Only traffic from the matching paid campaign belongs in Apple's campaign
// report. Direct visits, other sources and QA keep the normal store link.
export function campaignUrlForVisit(params, officialCampaignUrl = '') {
  if (!officialCampaignUrl) return '';
  try {
    const url = new URL(officialCampaignUrl);
    const campaign = url.searchParams.get('ct');
    if (url.protocol !== 'https:' || url.hostname !== 'apps.apple.com' ||
        !/\/id6756235224(?:\/|$)/.test(url.pathname) ||
        !/^\d+$/.test(url.searchParams.get('pt') || '') || !campaign ||
        params.get('utm_source') !== 'yandex' || params.get('utm_medium') !== 'cpc' ||
        params.get('utm_campaign') !== campaign) return '';
    return url.href;
  } catch { return ''; }
}

export function smartAppBannerContent(params, officialCampaignUrl = '') {
  const campaignUrl = campaignUrlForVisit(params, officialCampaignUrl);
  if (!campaignUrl) return 'app-id=6756235224';
  const campaign = new URL(campaignUrl).searchParams;
  const affiliate = new URLSearchParams({pt:campaign.get('pt'),ct:campaign.get('ct')});
  return `app-id=6756235224, affiliate-data=${affiliate}`;
}
