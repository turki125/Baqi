import type { AlertCriteria, Listing } from '@workspace/api-client-react';

export type Lang = 'en' | 'ar';
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const REQ = { credentials: 'include' as const };

export function photoUrl(photo?: string | null): string | null {
  if (!photo) return null;
  if (photo.startsWith('/objects/')) return `/api/storage${photo}`;
  return photo;
}

const locale = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-SA');

export function fmtMoney(value: number, lang: Lang) {
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'SAR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
export function fmtNum(value: number, lang: Lang) {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 9 }).format(value);
}
export function fmtDate(value: string, lang: Lang) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
export function fmtTime(value: string, lang: Lang) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** Mirrors the reservation rules: full lots take everything, partial sales round up to the next increment. */
export function reservationMath(item: Listing, requested: number) {
  const requestedQuantity = item.saleMode === 'full_lot' ? item.quantity : requested;
  const actualQuantity = item.saleMode === 'full_lot'
    ? item.quantity
    : Number((Math.ceil((requestedQuantity - 1e-9) / item.minimumIncrement) * item.minimumIncrement).toPrecision(12));
  const hasExcess = actualQuantity > requestedQuantity + 1e-9;
  const exceedsStock = actualQuantity > item.quantity + 1e-9;
  const invalid = !(requestedQuantity > 0);
  const total = item.isFree ? 0 : Math.round((item.unitPrice ?? 0) * actualQuantity * 100) / 100;
  const deposit = item.isFree ? 0 : Math.min(total, Math.max(0.01, Math.round(total * 0.1 * 100) / 100));
  const balance = Math.round((total - deposit) * 100) / 100;
  return { requestedQuantity, actualQuantity, hasExcess, exceedsStock, invalid, total, deposit, balance };
}

export function signInHref(target: string) {
  return `/sign-in?redirect=${encodeURIComponent(`${basePath}${target}`)}`;
}

export function safeRedirect(search: string) {
  const redirectPath = new URLSearchParams(search).get('redirect') || '';
  try {
    const origin = 'https://baqi.invalid';
    const target = new URL(redirectPath, origin);
    const ok = redirectPath.startsWith('/') && !redirectPath.startsWith('//') && !redirectPath.includes('\\') &&
      target.origin === origin &&
      (!basePath || target.pathname === basePath || target.pathname.startsWith(`${basePath}/`));
    return ok ? `${target.pathname}${target.search}${target.hash}` : `${basePath}/`;
  } catch { return `${basePath}/`; }
}

const PENDING_KEY = 'baqi-pending-reservation';
export type PendingReservation = { listingId: string; quantity: number; excessAccepted: boolean };
export function savePending(p: PendingReservation) { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); }
export function readPending(listingId: string): PendingReservation | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null') as PendingReservation | null;
    return p && p.listingId === listingId ? p : null;
  } catch { return null; }
}
export function clearPending() { sessionStorage.removeItem(PENDING_KEY); }

/** Unsaved availability-alert request, kept only for the guest -> sign-in hop. */
export const ALERT_INTENT_KEY = 'baqi-availability-alert-intent';
const ALERT_INTENT_TTL = 30 * 60 * 1000;
export type AlertIntent = { criteria: AlertCriteria; emailEnabled: boolean; userId: string | null; at: number };
export function saveAlertIntent(criteria: AlertCriteria, emailEnabled: boolean, userId: string | null) {
  sessionStorage.setItem(ALERT_INTENT_KEY, JSON.stringify({ criteria, emailEnabled, userId, at: Date.now() } satisfies AlertIntent));
}
export function clearAlertIntent() { sessionStorage.removeItem(ALERT_INTENT_KEY); }
export function readAlertIntent(userId: string | null): AlertIntent | null {
  try {
    const i = JSON.parse(sessionStorage.getItem(ALERT_INTENT_KEY) || 'null') as AlertIntent | null;
    if (!i || typeof i.criteria !== 'object' || !i.criteria) return null;
    if (Date.now() - (i.at || 0) > ALERT_INTENT_TTL || (i.userId && i.userId !== userId)) { clearAlertIntent(); return null; }
    return i;
  } catch { clearAlertIntent(); return null; }
}

export const DRAFT_KEY = 'baqi-sell-draft';
export function clearPrivateSessionState() {
  clearPending();
  clearAlertIntent();
  sessionStorage.removeItem(DRAFT_KEY);
}

export function initials(name?: string | null) {
  const n = (name || '').trim();
  return n ? n.slice(0, 1).toUpperCase() : 'B';
}
