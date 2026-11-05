export async function verifyCaptcha(token, { secret, expectedHost, expectedAction = 'quiz_complete', fetcher = fetch } = {}) {
  if (!secret || !expectedHost) return { ok:false, status:503, error:'Verification is not configured yet.' };
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return { ok:false, status:400, error:'Please complete the verification check.' };
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret,response:token}), signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok:false, status:503, error:'Verification is temporarily unavailable. Please try again.' };
    const data=await response.json();
    if(data.success!==true||data.hostname!==expectedHost||data.action!==expectedAction) return { ok:false, status:403, error:'The check expired or could not be verified. Please try again.' };
    return { ok:true, status:200, verified:true };
  } catch { return { ok:false, status:503, error:'Verification is temporarily unavailable. Please try again.' }; }
}
