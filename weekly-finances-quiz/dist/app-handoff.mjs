// Only the server-issued app token is kept here; quiz answers and analytics IDs are not.
export const HANDOFF_STORAGE_KEY = 'wf-app-handoff-v1';
export const HANDOFF_WINDOW_MS = 21 * 86400000;
export const APP_OPEN_BASE_URL = 'https://financialplan.pistonsky.dev/open';

export function validAppHandoff(value, now = Date.now()) {
  if (!value || value.version !== 1 || typeof value.token !== 'string') return null;
  const token = value.token.toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token) || token === '00000000-0000-0000-0000-000000000000') return null;
  if (!Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + HANDOFF_WINDOW_MS + 300000) return null;
  return { version: 1, token, expiresAt: value.expiresAt };
}

export function loadAppHandoff(storage, now = Date.now()) {
  try {
    const value = validAppHandoff(JSON.parse(storage.getItem(HANDOFF_STORAGE_KEY)), now);
    if (!value) storage.removeItem(HANDOFF_STORAGE_KEY);
    return value;
  } catch { return null; }
}

export function saveAppHandoff(storage, value, now = Date.now()) {
  const record = validAppHandoff(value, now);
  if (!record) return false;
  try { storage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(record)); return true; } catch { return false; }
}

export function clearAppHandoff(storage) {
  try { storage.removeItem(HANDOFF_STORAGE_KEY); } catch {}
}

export function appOpenUrl(value, now = Date.now()) {
  const record = validAppHandoff(value, now);
  if (!record) return null;
  const url = new URL(APP_OPEN_BASE_URL);
  url.searchParams.set('token', record.token);
  return url.href;
}

export function analyticsAttribution({ allowed, clientId, yclid }) {
  if (!allowed) return null;
  const value = { analyticsAllowed: true };
  if (typeof clientId === 'string' && /^\d{1,32}$/.test(clientId)) value.clientId = clientId;
  if (typeof yclid === 'string' && /^\d{1,64}$/.test(yclid)) value.yclid = yclid;
  return value.clientId || value.yclid ? value : null;
}
