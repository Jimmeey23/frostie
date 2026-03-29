const BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function call(fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const sendOtp = (email: string) => call('send-otp', { to: email });

export const memberLookup = (email: string) => call('momence-api', { action: 'member-lookup', email });

export const freezeHistory = (email: string) => call('momence-api', { action: 'freeze-history', email });

export const freezeMembership = (params: {
  memberId: number; boughtMembershipId: number; startDate: string; endDate: string;
  operation?: string; memberName?: string; memberEmail?: string;
}) => call('momence-api', { action: 'freeze-membership', ...params });

export const unfreezeMembership = (params: {
  memberId: number; boughtMembershipId: number; unfreezeDate?: string;
  operation?: string; memberName?: string; memberEmail?: string;
}) => call('momence-api', { action: 'unfreeze-membership', ...params });

export const restartMembership = (memberId: number, boughtMembershipId: number, memberName?: string, memberEmail?: string) =>
  call('momence-api', { action: 'restart-membership', memberId, boughtMembershipId, memberName, memberEmail });

export const sendConfirmation = (params: {
  to: string;
  memberName: string;
  membershipName: string;
  action: 'freeze' | 'unfreeze' | 'restart';
  freezeStart?: string;
  freezeEnd?: string;
  resumeDate?: string;
  unfreezeDate?: string;
}) => call('send-confirmation', params);

export const memberBookings = (memberId: number, page = 0, pageSize = 50) =>
  call('momence-api', { action: 'member-bookings', memberId, page, pageSize });

export const sessionsList = (params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) =>
  call('momence-api', { action: 'sessions-list', ...params });

export const sessionDetail = (sessionId: number) =>
  call('momence-api', { action: 'session-detail', sessionId });
