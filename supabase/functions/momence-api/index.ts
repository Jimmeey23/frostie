import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const BASIC_AUTH = 'Basic YXBpLTEzNzUyLXJHV2lvYk5jWW9kVG9mYUY6ZEdjZ3JGRHNRd091NnplS24zVk5peWNENkxIQXQ4eGI=';
const MOMENCE_USERNAME = 'jimmygonda@gmail.com';
const MOMENCE_PASSWORD = 'Jimmeey@123';
const MOMENCE_API_BASE = 'https://api.momence.com/api/v2';
const MAX_FREEZE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SPREADSHEET_ID = '1tmrT6ZNWRzWdvG5H31bBLAfTz4nd8G6vMjqRjrsMbLI';
const SHEET_NAME = 'Activity';

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt = 0;

// ─── Response Parsing ───
async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

// ─── Token Management ───
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) return cachedAccessToken;

  if (cachedRefreshToken) {
    try {
      const res = await fetch(`${MOMENCE_API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'authorization': BASIC_AUTH, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cachedRefreshToken }),
      });
      if (res.ok) {
        const d = await res.json();
        cachedAccessToken = d.access_token;
        cachedRefreshToken = d.refresh_token || cachedRefreshToken;
        tokenExpiresAt = Date.now() + (d.expires_in || 3600) * 1000;
        return cachedAccessToken!;
      }
    } catch { /* fall through */ }
  }

  const res = await fetch(`${MOMENCE_API_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'authorization': BASIC_AUTH, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username: MOMENCE_USERNAME, password: MOMENCE_PASSWORD }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Auth failed: ${res.status} ${t}`); }

  const d = await res.json();
  cachedAccessToken = d.access_token;
  cachedRefreshToken = d.refresh_token || cachedRefreshToken;
  tokenExpiresAt = Date.now() + (d.expires_in || 3600) * 1000;

  // Refresh for fresh tokens
  if (cachedRefreshToken) {
    try {
      const r2 = await fetch(`${MOMENCE_API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'authorization': BASIC_AUTH, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cachedRefreshToken }),
      });
      if (r2.ok) {
        const rd = await r2.json();
        cachedAccessToken = rd.access_token;
        cachedRefreshToken = rd.refresh_token || cachedRefreshToken;
        tokenExpiresAt = Date.now() + (rd.expires_in || 3600) * 1000;
      }
    } catch { /* use existing */ }
  }
  return cachedAccessToken!;
}

async function momenceRequest(pathname: string, init: RequestInit = {}, retry = true): Promise<any> {
  const token = await getAccessToken();
  const url = pathname.startsWith('http') ? pathname : `${MOMENCE_API_BASE}${pathname}`;
  const response = await fetch(url, {
    ...init,
    headers: { 'accept': 'application/json', ...(init.headers as Record<string, string> || {}), 'authorization': `Bearer ${token}` },
  });
  if ((response.status === 401 || response.status === 403) && retry) {
    cachedAccessToken = null; tokenExpiresAt = 0;
    return momenceRequest(pathname, init, false);
  }
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(JSON.stringify({ status: response.status, data }));
  return data;
}

// ─── Google Sheets Logging ───
const HEADER_ROW = [
  'Timestamp', 'Status', 'Action', 'Member ID', 'Member Name', 'Member Email',
  'Bought Membership ID', 'Membership Name', 'Location', 'Start Date', 'End Date',
  'Freeze History', 'Freeze Eligibility', 'Freeze At', 'Unfreeze At', 'Resume At',
  'Requested Days', 'Note',
];

async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error('No access token');
  return access_token;
}

async function ensureHeaderRow(accessToken: string) {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:R1`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const firstRow = data.values?.[0];
    if (!firstRow || firstRow.length === 0 || firstRow[0] !== HEADER_ROW[0]) {
      // Insert header row at row 1
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:R1?valueInputOption=USER_ENTERED`,
        { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [HEADER_ROW] }) }
      );
    }
  } catch (e) { console.error('Header row check failed:', e); }
}

async function appendToSheet(row: string[]) {
  const clientId = Deno.env.get('GOOGLE_SHEETS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_SHEETS_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_SHEETS_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    console.log('Google Sheets logging not configured, skipping');
    return;
  }
  try {
    const accessToken = await getGoogleAccessToken(clientId, clientSecret, refreshToken);
    await ensureHeaderRow(accessToken);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A:R:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) }
    );
  } catch (e) { console.error('Sheets log failed:', e); }
}

function buildLogRow(entry: Record<string, string>) {
  return [
    new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, 'Z'),
    entry.status || '', entry.action || '', entry.memberId || '',
    entry.memberName || '', entry.memberEmail || '', entry.boughtMembershipId || '',
    entry.membershipName || '', entry.location || '', entry.startDate || '',
    entry.endDate || '', entry.freezeHistory || '', entry.freezeEligibility || '',
    entry.freezeAt || '', entry.unfreezeAt || '', entry.resumeAt || '',
    entry.requestedDays || '', entry.note || '',
  ];
}

// ─── Freeze Policy ───
const FREEZE_POLICY: [string, number, number][] = [
  ['Barre 1 month Unlimited', 1, 30], ['Barre 2 week Unlimited', 0, 14],
  ['Barre 3 months Unlimited', 3, 90], ['Barre 6 month Unlimited', 6, 180],
  ['Barre Annual Membership', 12, 365], ['powerCycle 1 month Unlimited', 1, 30],
  ['powerCycle 2 week Unlimited', 0, 14], ['powerCycle 3 months Unlimited', 3, 90],
  ['powerCycle 6 months Unlimited', 6, 180], ['powerCycle Annual Membership', 12, 365],
  ['Strength Lab 1 month Unlimited', 1, 30], ['Strength Lab 2 week Unlimited', 0, 14],
  ['Strength Lab 3 months Unlimited', 3, 90], ['Strength Lab 6 months Unlimited', 6, 180],
  ['Strength Lab Annual Membership', 12, 365], ['Studio 1 Month Unlimited Membership', 1, 30],
  ['Studio 10 Single Class Pack', 2, 70], ['Studio 12 Class Package', 2, 45],
  ['Studio 2 Week Unlimited Membership', 0, 14], ['Studio 20 Single Class Pack', 4, 105],
  ['Studio 3 Month U/L Monthly Installment', 1, 30], ['Studio 3 Month Unlimited Membership', 3, 90],
  ['Studio 30 Single Class Pack', 5, 140], ['Studio 4 Class Package', 0, 14],
  ['Studio 6 Month Unlimited Membership', 6, 180], ['Studio 8 Class Package', 1, 30],
  ['Studio Annual Membership - Monthly Intsallment', 1, 30],
  ['Studio Annual Unlimited Membership', 12, 365], ['Studio Extended 10 Single Class Pack', 3, 90],
  ['Studio Happy Hour Private', 0, 7], ['Studio Newcomers 2 Week Unlimited Membership', 0, 14],
  ['Studio Private - Anisha (Single Class)', 0, 7], ['Studio Private Class', 0, 7],
  ['Studio Private Class X 10', 2, 70], ['Studio Privates - Anisha x 10', 2, 70],
  ['Summer Bootcamp - Studio 6 Week Unlimited', 1, 42], ['Virtual Private - Anisha', 0, 7],
  ['Virtual Private Class', 0, 7], ['Virtual Private Class X 10', 2, 70],
  ['Virtual Privates - Anisha x 10', 17, 500],
];

const FREEZE_MAP = new Map(FREEZE_POLICY.map(([n, a, d]) => [n.trim().toLowerCase().replace(/\s+/g, ' '), { name: n, attempts: a, days: d }]));

function getPolicy(name: string) {
  return FREEZE_MAP.get((name || '').trim().toLowerCase().replace(/\s+/g, ' ')) || null;
}

function buildFreezeFallback(m: any) {
  const f = m.freeze || {};
  const start = f.freezedAt || f.scheduledFreezeAt;
  const end = f.unfrozenAt || f.unfreezedScheduledAt;
  if (!start) return { attemptsUsed: 0, frozenDaysUsed: 0, intervals: [] };
  const s = Date.parse(start), e = Date.parse(end || new Date().toISOString());
  const days = Number.isFinite(s) && Number.isFinite(e) ? Math.max(0, Math.ceil((e - s) / MS_PER_DAY)) : 0;
  return { attemptsUsed: 1, frozenDaysUsed: days, intervals: [{ freezeAt: start, unfreezeAt: end || null }] };
}

function evaluate(m: any, policy: any, usage: any, reqDays: number | null = null) {
  if (!policy) return { eligible: false, reason: 'No freeze policy for this membership.', attemptsRemaining: 0, daysRemaining: 0 };
  if (policy.attempts <= 0) return { eligible: false, reason: 'No freeze allowance.', attemptsRemaining: 0, daysRemaining: 0 };
  if (m.isFrozen) return { eligible: false, reason: 'Already frozen.', attemptsRemaining: Math.max(policy.attempts - usage.attemptsUsed, 0), daysRemaining: Math.max(policy.days - usage.frozenDaysUsed, 0) };
  const ar = Math.max(policy.attempts - usage.attemptsUsed, 0);
  const dr = Math.max(policy.days - usage.frozenDaysUsed, 0);
  if (ar <= 0) return { eligible: false, reason: 'Freeze attempt limit reached.', attemptsRemaining: ar, daysRemaining: dr };
  if (dr <= 0) return { eligible: false, reason: 'Freeze day limit reached.', attemptsRemaining: ar, daysRemaining: dr };
  if (reqDays !== null && reqDays > dr) return { eligible: false, reason: `Exceeds remaining ${dr} days.`, attemptsRemaining: ar, daysRemaining: dr };
  if (reqDays !== null && reqDays > MAX_FREEZE_DAYS) return { eligible: false, reason: `Max ${MAX_FREEZE_DAYS} days per freeze.`, attemptsRemaining: ar, daysRemaining: dr };
  return { eligible: true, reason: 'Eligible for freeze.', attemptsRemaining: ar, daysRemaining: dr };
}

function serialize(m: any, usage: any) {
  const policy = getPolicy(m.membership?.name);
  const elig = evaluate(m, policy, usage);
  const maxWindow = Math.min(elig.daysRemaining, MAX_FREEZE_DAYS);
  const schedFreeze = m.freeze?.scheduledFreezeAt || m.freeze?.freezeAt || null;
  const schedUnfreeze = m.freeze?.unfreezedScheduledAt || m.freeze?.scheduledUnfreezeAt || null;

  const location = m.location?.name || m.membership?.location?.name || m.hostLocation?.name || 'Mumbai';

  return {
    id: m.id, type: m.type, startDate: m.startDate, endDate: m.endDate,
    isFrozen: m.isFrozen, freeze: m.freeze || null,
    scheduledFreezeAt: schedFreeze, scheduledUnfreezeAt: schedUnfreeze, location,
    membership: { id: m.membership?.id, name: m.membership?.name, description: m.membership?.description, duration: m.membership?.duration, durationUnit: m.membership?.durationUnit },
    freezePolicy: policy, freezeUsage: usage,
    freezeEligibility: { ...elig, maxWindowDays: maxWindow },
    actions: {
      canFreeze: elig.eligible && !m.isFrozen,
      canUnfreeze: Boolean(m.isFrozen),
      canRemoveScheduledFreeze: Boolean(!m.isFrozen && schedFreeze),
      canRemoveScheduledUnfreeze: Boolean(schedUnfreeze),
    },
  };
}

// ─── Main Handler ───
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    // ── MEMBER LOOKUP ──
    if (action === 'member-lookup') {
      const { email } = body;
      if (!email) return respond({ error: 'Email required.' }, 400);

      const search = await momenceRequest(`/host/members?page=0&pageSize=100&sortOrder=DESC&sortBy=lastSeenAt&query=${encodeURIComponent(email)}`);
      const members = Array.isArray(search.payload) ? search.payload : [];
      const el = email.trim().toLowerCase();
      const member = members.find((m: any) => (m.email || '').trim().toLowerCase() === el) || members[0];
      if (!member?.id) return respond({ error: 'No member found.' }, 404);

      const [details, msRes] = await Promise.all([
        momenceRequest(`/host/members/${member.id}`),
        momenceRequest(`/host/members/${member.id}/bought-memberships/active?page=0&pageSize=200&includeFrozen=true`),
      ]);

      const active = Array.isArray(msRes.payload) ? msRes.payload : [];
      const views = active.map((m: any) => serialize(m, buildFreezeFallback(m)));

      return respond({ member: details, memberships: views });
    }

    // ── FREEZE ──
    if (action === 'freeze-membership') {
      const { memberId, boughtMembershipId, startDate, endDate, operation = 'scheduled-window', reason, memberName, memberEmail } = body;
      if (!memberId || !boughtMembershipId) return respond({ error: 'Missing IDs.' }, 400);

      const msRes = await momenceRequest(`/host/members/${memberId}/bought-memberships/active?page=0&pageSize=200&includeFrozen=true`);
      const selected = (msRes.payload || []).find((m: any) => String(m.id) === String(boughtMembershipId));
      if (!selected) return respond({ error: 'Membership not found.' }, 404);

      const usage = buildFreezeFallback(selected);
      const view = serialize(selected, usage);

      let reqPath = '', reqBody: any = {}, freezeAt = '', unfreezeAt = '';

      if (operation === 'scheduled-window') {
        if (!startDate || !endDate) return respond({ error: 'Start and end dates required.' }, 400);
        reqPath = `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-freeze`;
        reqBody = { freezeType: 'scheduled', unfreezeType: 'scheduled', freezeAt: startDate, unfreezeAt: endDate, reason: reason || null };
        freezeAt = startDate; unfreezeAt = endDate;
      } else if (operation === 'freeze-now') {
        reqPath = `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-freeze`;
        reqBody = { freezeType: 'now', freezeAt: null, unfreezeType: 'not_set', unfreezeAt: null };
        freezeAt = new Date().toISOString();
      }

      let reqDays: number | null = null;
      if (freezeAt && unfreezeAt) reqDays = Math.ceil((Date.parse(unfreezeAt) - Date.parse(freezeAt)) / MS_PER_DAY) + 1;
      const elig = evaluate(selected, view.freezePolicy, usage, reqDays);
      if (!elig.eligible) return respond({ error: elig.reason, eligibility: elig }, 400);

      const apiResult = await momenceRequest(reqPath, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reqBody) });

      const resumeAt = unfreezeAt ? new Date(Date.parse(unfreezeAt) + MS_PER_DAY).toISOString() : '';

      await appendToSheet(buildLogRow({
        status: 'SUCCESS', action: 'Freeze membership', memberId: String(memberId),
        memberName: memberName || '', memberEmail: memberEmail || '',
        boughtMembershipId: String(boughtMembershipId), membershipName: view.membership.name || '',
        location: view.location, startDate: view.startDate, endDate: view.endDate,
        freezeHistory: (usage.intervals || []).map((i: any) => `${i.freezeAt?.slice(0,10)} → ${i.unfreezeAt?.slice(0,10) || 'ongoing'}`).join(' | '),
        freezeEligibility: elig.reason, freezeAt, unfreezeAt, resumeAt,
        requestedDays: reqDays !== null ? String(reqDays) : '', note: 'Scheduled freeze.',
      }));

      return respond({ ok: true, operation, message: 'Freeze applied.', freezeAt, unfreezeAt, resumeAt, requestedDays: reqDays, eligibility: elig, apiResponse: apiResult });
    }

    // ── SCHEDULE UNFREEZE ──
    if (action === 'unfreeze-membership') {
      const { memberId, boughtMembershipId, unfreezeDate, operation = 'schedule-unfreeze', memberName, memberEmail } = body;
      if (!memberId || !boughtMembershipId) return respond({ error: 'Missing IDs.' }, 400);

      if (operation === 'remove-scheduled-unfreeze') {
        const result = await momenceRequest(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-unfreeze`, { method: 'DELETE' });
        await appendToSheet(buildLogRow({ status: 'SUCCESS', action: 'Remove scheduled unfreeze', memberId: String(memberId), memberName: memberName || '', memberEmail: memberEmail || '', boughtMembershipId: String(boughtMembershipId), note: 'Scheduled unfreeze removed.' }));
        return respond({ ok: true, operation, message: 'Scheduled unfreeze removed.', apiResponse: result });
      }

      if (!unfreezeDate) return respond({ error: 'Unfreeze date required.' }, 400);
      const result = await momenceRequest(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-unfreeze`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unfreezeType: 'scheduled', unfreezeAt: unfreezeDate }),
      });

      const resumeAt = new Date(Date.parse(unfreezeDate) + MS_PER_DAY).toISOString();
      await appendToSheet(buildLogRow({ status: 'SUCCESS', action: 'Schedule unfreeze', memberId: String(memberId), memberName: memberName || '', memberEmail: memberEmail || '', boughtMembershipId: String(boughtMembershipId), unfreezeAt: unfreezeDate, resumeAt, note: 'Unfreeze scheduled.' }));
      return respond({ ok: true, operation, message: 'Unfreeze scheduled.', unfreezeAt: unfreezeDate, resumeAt, apiResponse: result });
    }

    // ── RESTART (remove freeze / unfreeze immediately) ──
    if (action === 'restart-membership') {
      const { memberId, boughtMembershipId, memberName, memberEmail } = body;
      if (!memberId || !boughtMembershipId) return respond({ error: 'Missing IDs.' }, 400);

      const result = await momenceRequest(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-freeze`, { method: 'DELETE' });
      await appendToSheet(buildLogRow({ status: 'SUCCESS', action: 'Restart/unfreeze membership', memberId: String(memberId), memberName: memberName || '', memberEmail: memberEmail || '', boughtMembershipId: String(boughtMembershipId), note: 'Membership restarted.' }));
      return respond({ ok: true, message: 'Membership restarted.', apiResponse: result });
    }

    // ── FREEZE HISTORY ──
    if (action === 'freeze-history') {
      const { email } = body;
      if (!email) return respond({ error: 'Email required.' }, 400);

      const search = await momenceRequest(`/host/members?page=0&pageSize=100&sortOrder=DESC&sortBy=lastSeenAt&query=${encodeURIComponent(email)}`);
      const members = Array.isArray(search.payload) ? search.payload : [];
      const el = email.trim().toLowerCase();
      const member = members.find((m: any) => (m.email || '').trim().toLowerCase() === el) || members[0];
      if (!member?.id) return respond({ error: 'No member found.' }, 404);

      const msRes = await momenceRequest(`/host/members/${member.id}/bought-memberships/active?page=0&pageSize=200&includeFrozen=true`);
      const active = Array.isArray(msRes.payload) ? msRes.payload : [];

      const rows = active.map((m: any) => {
        const usage = buildFreezeFallback(m);
        const policy = getPolicy(m.membership?.name);
        const elig = policy ? evaluate(m, policy, usage) : { eligible: false, reason: 'No policy', attemptsRemaining: 0, daysRemaining: 0 };
        const location = m.location?.name || m.membership?.location?.name || m.hostLocation?.name || 'Mumbai';

        return {
          membershipId: m.id,
          membershipName: m.membership?.name || '',
          location,
          startDate: m.startDate,
          endDate: m.endDate,
          isFrozen: m.isFrozen,
          scheduledFreezeAt: m.freeze?.scheduledFreezeAt || m.freeze?.freezeAt || null,
          scheduledUnfreezeAt: m.freeze?.unfreezedScheduledAt || m.freeze?.scheduledUnfreezeAt || null,
          freezePolicy: policy,
          freezeUsage: usage,
          freezeEligibility: elig,
        };
      });

      return respond({ memberId: member.id, memberName: `${member.firstName} ${member.lastName}`, rows });
    }

    return respond({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Edge function error:', error);
    return respond({ error: (error as Error).message || 'Internal error' }, 500);
  }
});
