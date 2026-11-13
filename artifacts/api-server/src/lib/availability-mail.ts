import { clerkClient } from "@clerk/express";
import { db, availabilityLocalMailTable, type AvailabilityMatchRow } from "@workspace/db";
import type { AvailabilityCard } from "@workspace/api-zod";

export async function accountEmail(buyerId: string) {
  const user = await clerkClient.users.getUser(buyerId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return { address: primary?.emailAddress ?? "", verified: primary?.verification?.status === "verified" };
}

export function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  return domain ? `${local.slice(0, 1)}•••@${domain}` : "";
}

export function emailMode(): "local" | "resend" | "unavailable" {
  const mode = process.env.ALERT_EMAIL_ADAPTER ?? (process.env.NODE_ENV === "production" ? "resend" : "local");
  if (mode === "local") return process.env.NODE_ENV === "production" ? "unavailable" : "local";
  if (mode === "resend" && process.env.RESEND_API_KEY && process.env.BAQI_EMAIL_FROM && publishedUrl()) return "resend";
  return "unavailable";
}

function publishedUrl(): string | null {
  try {
    const url = new URL(process.env.BAQI_PUBLIC_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (/(?:\.replit\.dev|\.test|\.invalid|\.localhost)$/.test(url.hostname) || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
    return url.href.replace(/\/$/, "");
  } catch { return null; }
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const ALERT_EMAIL_SUBJECT = "توفّر إعلان يناسب طلبك في باقي";
export function renderAvailabilityEmail(match: AvailabilityMatchRow, token: string, baseUrl: string, local: boolean) {
  const card = match.snapshot as unknown as AvailabilityCard;
  const listingUrl = `${baseUrl}/listing/${encodeURIComponent(match.listingId)}`;
  const unsubscribeUrl = `${baseUrl}/email-unsubscribe?token=${encodeURIComponent(token)}`;
  const num = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 3 });
  const price = card.isFree ? "مجاني" : `${num(card.totalPrice)} ر.س للكمية القابلة للشراء`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f3;color:#1c2c29;font-family:Tahoma,Arial,sans-serif;direction:rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:560px;margin:auto;background:white;border-radius:16px" cellpadding="24">
<tr><td><h1 style="font-size:24px;color:#075e54">باقي</h1>
${local ? '<p style="padding:12px;background:#fff1ce">نسخة اختبار محلية — لم يُرسل هذا البريد. الروابط أدناه تستخدم عنوان اختبار، وليست الموقع المنشور.</p>' : ""}
<h2 style="font-size:22px">${ALERT_EMAIL_SUBJECT}</h2>
<p style="line-height:1.9">${esc(match.explanation)}</p><h3>${esc(card.title)}</h3>
<p>المتاح: ${num(card.quantity)} ${esc(card.unit)}${card.requestedQuantity !== null ? ` · المطلوب: ${num(card.requestedQuantity)} ${esc(card.unit)}` : ""}</p>
<p>الكمية القابلة للشراء: ${num(card.purchaseQuantity)} ${esc(card.unit)} · ${esc(card.saleMode === "full_lot" ? "الكمية كاملة" : "بيع جزئي")}</p>
<p>${esc(price)} · حي ${esc(card.neighborhood)} · الرياض</p>
<p style="margin:28px 0"><a href="${esc(listingUrl)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#075e54;color:white;text-decoration:none">شاهد الإعلان</a></p>
<p style="color:#586a65;font-size:14px;line-height:1.8">التنبيه للمعلومية فقط، ولا يحجز الكمية ولا ينشئ طلباً. قد تتغير إتاحة الإعلان.</p>
<a href="${esc(unsubscribeUrl)}" style="color:#586a65;font-size:13px">إيقاف رسائل البريد لهذا التنبيه</a>
<p style="color:#586a65;font-size:12px">إيقاف البريد لا يوقف رسائل باقي داخل الموقع. يمكنك إدارة البحث من حسابك.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { html, listingUrl, unsubscribeUrl };
}

export class MailDeliveryError extends Error {
  constructor(public retryable: boolean, public code: string) { super(code); }
}

export async function deliverAvailabilityEmail(match: AvailabilityMatchRow, recipient: string, token: string, transaction?: Pick<typeof db, "insert">) {
  const mode = emailMode();
  if (mode === "unavailable") throw new MailDeliveryError(true, "configuration_missing");
  const baseUrl = mode === "local" ? (process.env.BAQI_TEST_URL || "https://baqi-alerts.test").replace(/\/$/, "") : publishedUrl()!;
  const rendered = renderAvailabilityEmail(match, token, baseUrl, mode === "local");
  if (mode === "local") {
    await (transaction ?? db).insert(availabilityLocalMailTable).values({
      matchId: match.id, recipient, subject: ALERT_EMAIL_SUBJECT, html: rendered.html, testUrl: baseUrl,
    }).onConflictDoNothing();
    return { status: "local_captured", providerId: null };
  }
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `baqi-availability-${match.id}` },
      body: JSON.stringify({ from: process.env.BAQI_EMAIL_FROM, to: [recipient], subject: ALERT_EMAIL_SUBJECT, html: rendered.html }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new MailDeliveryError(true, "network_or_timeout"); }
  if (!response.ok) throw new MailDeliveryError(response.status === 429 || response.status >= 500, `provider_http_${response.status}`);
  const body = await response.json() as { id?: string };
  if (!body.id) throw new MailDeliveryError(true, "provider_missing_id");
  // Provider acceptance is not proof that a recipient received the email.
  return { status: "provider_accepted", providerId: body.id };
}
