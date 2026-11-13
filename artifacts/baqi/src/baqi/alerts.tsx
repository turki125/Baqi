import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getGetAlertEmailStatusQueryKey, getListAvailabilityAlertsQueryKey, useGetAlertEmailStatus, useListCategories,
  usePreviewAvailabilityAlert, useSaveAvailabilityAlert,
} from '@workspace/api-client-react';
import type { AlertCriteria, AlertEmailStatus, AlertSearchInput, AvailabilityAlert } from '@workspace/api-client-react';
import { AlertCircle, BellOff, Check, FlaskConical, ImageIcon, Mail, MessageCircle, RotateCcw, SearchCheck, ShieldAlert } from 'lucide-react';
import { useLang } from './lang';
import { Button, ListingPhoto, Modal, Spinner, btn, cx, useMember } from './ui';
import { REQ, clearAlertIntent, readAlertIntent, saveAlertIntent, signInHref } from '@/lib/baqi';

export type AlertDraft = { criteria: AlertCriteria; emailEnabled: boolean };

/** Messages, conversation list and alerts all reflect alert state; refresh them together. */
export function invalidateAlertSurfaces(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: getListAvailabilityAlertsQueryKey() }),
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/conversations') }),
  ]);
}

export function hasSearchCriteria(s: AlertSearchInput) {
  return !!(s.q?.trim() || s.categoryId || s.condition || s.freeOnly || s.objectPath || s.minQuantity);
}

/* ---------- criteria labels ---------- */

export function useCriteriaChips() {
  const { tr, num, money, isAr } = useLang();
  const categories = useListCategories({ request: REQ });
  return (c: AlertCriteria) => {
    const L = (v: string) => isAr ? localizeTerm(v) ?? v : v;
    const cat = c.categoryId ? categories.data?.find((x) => x.id === c.categoryId) : undefined;
    const cond = c.condition === 'new' ? tr('New', 'جديد') : c.condition === 'like_new' ? tr('Like new', 'شبه جديد') : c.condition === 'used' ? tr('Used', 'مستعمل') : '';
    return [
      c.material && { k: 'material', l: tr('Material', 'المادة'), v: L(c.material) },
      c.keywords && c.keywords !== c.material && { k: 'keywords', l: tr('Keywords', 'كلمات'), v: c.keywords },
      c.color && { k: 'color', l: tr('Color', 'اللون'), v: L(c.color) },
      c.dimensions && { k: 'dimensions', l: tr('Size', 'المقاس'), v: c.dimensions },
      c.model && { k: 'model', l: tr('Model', 'الطراز'), v: c.model },
      c.finish && { k: 'finish', l: tr('Finish', 'التشطيب'), v: L(c.finish) },
      c.quantity && { k: 'quantity', l: tr('Quantity', 'الكمية'), v: `${num(c.quantity)} ${c.unit ?? ''}`.trim() },
      c.budget !== undefined && { k: 'budget', l: tr('Total budget', 'الميزانية'), v: money(c.budget) },
      c.maxUnitPrice !== undefined && { k: 'maxUnitPrice', l: tr('Max per unit', 'أعلى سعر للوحدة'), v: money(c.maxUnitPrice) },
      c.neighborhood && { k: 'neighborhood', l: tr('Pickup', 'الاستلام'), v: c.neighborhood },
      c.categoryId && { k: 'category', l: tr('Category', 'الفئة'), v: cat ? (isAr ? cat.nameAr : cat.nameEn) : c.categoryId },
      cond && { k: 'condition', l: tr('Condition', 'الحالة'), v: cond },
      c.freeOnly && { k: 'free', l: tr('Price', 'السعر'), v: tr('Free only', 'مجاني فقط') },
      c.objectPath && { k: 'photo', l: tr('Reference', 'المرجع'), v: tr('Photo match', 'مطابقة بالصورة') },
    ].filter(Boolean) as { k: string; l: string; v: string }[];
  };
}

export function alertTitle(c: AlertCriteria, tr: (en: string, ar: string) => string) {
  const m = c.material && tr('x', 'ar') === 'ar' ? localizeTerm(c.material) : c.material;
  return m || c.keywords || c.requestText || (c.objectPath ? tr('Photo search', 'بحث بالصورة') : tr('Saved search', 'بحث محفوظ'));
}

export function CriteriaChips({ criteria, testPrefix = 'chip-criteria' }: { criteria: AlertCriteria; testPrefix?: string }) {
  const chips = useCriteriaChips()(criteria);
  return <ul className="flex flex-wrap gap-1.5">
    {chips.map((c) => <li key={c.k} className="inline-flex max-w-full items-baseline gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[12.5px]" data-testid={`${testPrefix}-${c.k}`}>
      <span className="text-muted-foreground">{c.l}</span><span className="truncate font-semibold num"><bdi>{c.v}</bdi></span></li>)}
  </ul>;
}

/* ---------- zero-result prompt ---------- */

export function AlertPrompt({ search, onPreview }: { search: AlertSearchInput; onPreview: (draft: AlertDraft) => void }) {
  const { tr } = useLang();
  const preview = usePreviewAvailabilityAlert({ request: REQ });
  const run = () => {
    if (preview.isPending) return;
    preview.mutate({ data: search }, { onSuccess: (criteria) => onPreview({ criteria, emailEnabled: false }) });
  };
  return <div className="rise relative mx-auto mt-4 max-w-xl overflow-hidden rounded-2xl border border-primary/20 bg-secondary/70 p-5 sm:p-6" data-testid="panel-availability-alert">
    <div className="pointer-events-none absolute -end-10 -top-10 size-32 rounded-full border-[14px] border-primary/[.06]" aria-hidden />
    <div className="relative flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><SearchCheck size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{tr('Not listed yet? We will keep looking.', 'ما توفّر الحين؟ نكمّل البحث عنك.')}</p>
        <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">{tr('Save this search and the first listing that fully meets it lands in your Messages.', 'احفظ هذا البحث، وأول إعلان يطابقه بالكامل يوصلك في الرسائل.')}</p>
        <Button className="mt-4" onClick={run} disabled={preview.isPending} testId="button-notify-when-available">
          {preview.isPending ? <Spinner /> : <SearchCheck size={16} />}{tr('Notify me when available', 'نبّهني إذا توفّر')}
        </Button>
        {preview.isError && <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-[13px] font-medium text-destructive" data-testid="status-alert-preview-error">
          <AlertCircle size={14} />{tr('We could not prepare this alert.', 'تعذر تجهيز التنبيه.')}
          <button type="button" onClick={run} className="underline underline-offset-2" data-testid="button-alert-preview-retry">{tr('Try again', 'أعد المحاولة')}</button></p>}
      </div>
    </div>
  </div>;
}

/** Re-open the editor after sign-in when the URL carries the restore marker. Never auto-saves. */
export function useRestoreAlertIntent(param: string, value: string, open: (d: AlertDraft) => void) {
  const { isLoaded, user } = useMember();
  const uid = user?.id ?? null;
  useEffect(() => {
    if (!isLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(param) !== value) return;
    const intent = readAlertIntent(uid);
    if (intent) open({ criteria: intent.criteria, emailEnabled: intent.emailEnabled });
    params.delete(param);
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }, [isLoaded, uid]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---------- editor ---------- */

/** Canonical English tokens the preview may return; shown in Arabic for Arabic buyers. Unknown values pass through untouched. */
const AR_TERMS: Record<string, string> = {
  tile: 'بلاط', tiles: 'بلاط', porcelain: 'بورسلان', cement: 'أسمنت', timber: 'خشب', wood: 'خشب', rebar: 'حديد تسليح', paint: 'دهان',
  beige: 'بيج', white: 'أبيض', gray: 'رمادي', grey: 'رمادي', black: 'أسود', brown: 'بني',
  matte: 'مطفي', polished: 'لامع',
};
export function localizeTerm(v?: string) {
  if (!v) return v;
  const exact = AR_TERMS[v.trim().toLowerCase()];
  if (exact) return exact;
  return v.split(/(\s+|,|،)/).map((w) => AR_TERMS[w.toLowerCase()] ?? w).join('');
}

const TEXT_KEYS = ['material', 'keywords', 'color', 'dimensions', 'model', 'finish', 'neighborhood'] as const;
type TextKey = typeof TEXT_KEYS[number];
type FormState = Record<TextKey | 'quantity' | 'unit' | 'budget' | 'maxUnitPrice' | 'categoryId' | 'condition', string> & { freeOnly: boolean };
const UNIT_SUGGESTIONS = ['m²', 'm', 'm³', 'piece', 'box', 'bag', 'sheet', 'roll', 'ton', 'kg', 'pallet', 'م²', 'متر', 'قطعة', 'كرتون', 'كيس', 'لوح', 'طن'];

function fromCriteria(c: AlertCriteria, isAr: boolean): FormState {
  const s = (v?: string | number) => v === undefined || v === null ? '' : String(v);
  const l = (v?: string) => isAr ? localizeTerm(v) ?? '' : s(v);
  return {
    material: l(c.material), keywords: s(c.keywords), color: l(c.color), dimensions: s(c.dimensions), model: s(c.model), finish: l(c.finish),
    neighborhood: s(c.neighborhood), quantity: s(c.quantity), unit: s(c.unit), budget: s(c.budget), maxUnitPrice: s(c.maxUnitPrice),
    categoryId: s(c.categoryId), condition: s(c.condition), freeOnly: !!c.freeOnly,
  };
}

function toCriteria(base: AlertCriteria, f: FormState): AlertCriteria {
  const out: AlertCriteria = { ...base };
  for (const k of TEXT_KEYS) { const v = f[k].trim(); if (v) out[k] = v; else delete out[k]; }
  const qty = f.quantity.trim();
  if (qty) out.quantity = Number(qty); else delete out.quantity;
  if (f.unit.trim()) out.unit = f.unit.trim(); else delete out.unit;
  for (const k of ['budget', 'maxUnitPrice'] as const) { const v = f[k].trim(); if (v) out[k] = Number(v); else delete out[k]; }
  if (f.categoryId) out.categoryId = f.categoryId; else delete out.categoryId;
  if (f.condition) out.condition = f.condition as AlertCriteria['condition']; else delete out.condition;
  if (f.freeOnly) out.freeOnly = true; else delete out.freeOnly;
  return out;
}

export function AlertEditor({ draft, onClose, returnTo }: { draft: AlertDraft | null; onClose: () => void; returnTo: string }) {
  const { tr } = useLang();
  const open = !!draft;
  return <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }} title={tr('Notify me when available', 'نبّهني إذا توفّر')}
    description={tr('Check what we will look for. Edit anything that is not quite right.', 'راجع اللي بنبحث عنه، وعدّل أي شي يحتاج تعديل.')}>
    {draft && <EditorBody key={JSON.stringify(draft)} draft={draft} onClose={onClose} returnTo={returnTo} />}
  </Modal>;
}

function EditorBody({ draft, onClose, returnTo }: { draft: AlertDraft; onClose: () => void; returnTo: string }) {
  const { tr } = useLang();
  const { user, isLoaded } = useMember();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const categories = useListCategories({ request: REQ });
  const emailStatus = useGetAlertEmailStatus({ query: { queryKey: getGetAlertEmailStatusQueryKey(), enabled: !!user }, request: REQ });
  const save = useSaveAvailabilityAlert({ request: REQ });
  const { isAr } = useLang();
  const [f, setF] = useState<FormState>(() => fromCriteria(draft.criteria, isAr));
  const [email, setEmail] = useState(draft.emailEnabled);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState<AvailabilityAlert | null>(null);
  const set = (k: keyof FormState) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const criteria = useMemo(() => toCriteria(draft.criteria, f), [draft.criteria, f]);

  const qty = Number(f.quantity);
  const errors: Partial<Record<keyof FormState | 'empty', string>> = {};
  if (f.quantity.trim() && (!Number.isFinite(qty) || qty <= 0 || qty > 1e8)) errors.quantity = tr('Enter a quantity greater than zero.', 'أدخل كمية أكبر من صفر.');
  if (f.quantity.trim() && !f.unit.trim()) errors.unit = tr('Add the unit for this quantity.', 'أضف وحدة هذه الكمية.');
  for (const k of ['budget', 'maxUnitPrice'] as const) { const n = Number(f[k]); if (f[k].trim() && (!Number.isFinite(n) || n < 0 || n > 1e8)) errors[k] = tr('Enter a valid amount.', 'أدخل مبلغاً صحيحاً.'); }
  const constraintCount = Object.keys(criteria).filter((k) => k !== 'requestText').length;
  if (!constraintCount) errors.empty = tr('Keep at least one detail so we know what to look for.', 'أبقِ تفصيلة واحدة على الأقل عشان نعرف وش ندوّر.');
  const invalid = Object.keys(errors).length > 0;

  const submit = () => {
    setTouched(true);
    if (invalid || save.isPending) return;
    if (!user) { saveAlertIntent(criteria, email, null); navigate(signInHref(returnTo)); return; }
    save.mutate({ data: { criteria, emailEnabled: email } }, {
      onSuccess: (alert) => { clearAlertIntent(); setSaved(alert); void invalidateAlertSurfaces(qc); },
    });
  };

  if (saved) return <SavedView alert={saved} status={emailStatus.data} onClose={onClose} />;

  const text = (k: TextKey, label: string, placeholder?: string) => <div className="space-y-1">
    <label htmlFor={`alert-${k}`} className="block text-[13px] font-semibold">{label}</label>
    <input id={`alert-${k}`} className="field" value={f[k]} onChange={(e) => set(k)(e.target.value)} placeholder={placeholder} dir="auto" maxLength={k === 'keywords' ? 300 : 100} data-testid={`input-alert-${k}`} />
  </div>;
  const errText = (k: keyof typeof errors) => touched && errors[k] ? <p role="alert" className="text-[12.5px] font-medium text-destructive">{errors[k]}</p> : null;

  return <div className="space-y-5" data-testid="form-availability-alert">
    {(draft.criteria.requestText || draft.criteria.objectPath) && <div className="flex items-start gap-3 rounded-xl bg-muted/70 p-3">
      {draft.criteria.objectPath && <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border" data-testid="img-alert-reference"><ListingPhoto src={draft.criteria.objectPath} alt={tr('Reference photo', 'الصورة المرجعية')} /></div>}
      <div className="min-w-0 text-[13px] leading-5">
        <p className="font-semibold text-muted-foreground">{tr('Your search', 'بحثك')}</p>
        {draft.criteria.requestText && <p className="mt-0.5 text-foreground" dir="auto" data-testid="text-alert-request">“{draft.criteria.requestText}”</p>}
        {draft.criteria.objectPath && <p className="mt-1 flex items-center gap-1 text-muted-foreground"><ImageIcon size={13} />{tr('We keep this photo privately to compare looks. Size and quantity are checked separately.', 'نحتفظ بالصورة بشكل خاص لمقارنة الشكل، ونتحقق من المقاس والكمية بشكل مستقل.')}</p>}
      </div>
    </div>}

    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="mb-2 text-sm font-bold">{tr('What you need', 'وش تحتاج')}</legend>
      <div className="col-span-2">{text('material', tr('Material', 'المادة'), tr('e.g. porcelain tile', 'مثال: بلاط بورسلان'))}</div>
      {(f.keywords || draft.criteria.keywords) ? <div className="col-span-2">{text('keywords', tr('Keywords', 'كلمات البحث'))}</div> : null}
      {text('dimensions', tr('Size', 'المقاس'), '60×60')}
      {text('color', tr('Color', 'اللون'), tr('beige', 'بيج'))}
      {text('model', tr('Model', 'الطراز'))}
      {text('finish', tr('Finish', 'التشطيب'), tr('matte', 'مطفي'))}
    </fieldset>

    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="mb-2 text-sm font-bold">{tr('Quantity and budget', 'الكمية والميزانية')}</legend>
      <div className="space-y-1">
        <label htmlFor="alert-quantity" className="block text-[13px] font-semibold">{tr('Total quantity', 'الكمية الإجمالية')}</label>
        <input id="alert-quantity" type="number" min="0" step="any" inputMode="decimal" className="field num" value={f.quantity} onChange={(e) => set('quantity')(e.target.value)} aria-invalid={touched && !!errors.quantity} data-testid="input-alert-quantity" />
        {errText('quantity')}
      </div>
      <div className="space-y-1">
        <label htmlFor="alert-unit" className="block text-[13px] font-semibold">{tr('Unit', 'الوحدة')}</label>
        <input id="alert-unit" list="alert-units" className="field" value={f.unit} onChange={(e) => set('unit')(e.target.value)} maxLength={40} dir="auto" aria-invalid={touched && !!errors.unit} data-testid="input-alert-unit" />
        <datalist id="alert-units">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
        {errText('unit')}
      </div>
      <p className="col-span-2 -mt-1 text-[12.5px] leading-5 text-muted-foreground">{tr('One listing must cover the whole quantity on its own.', 'لازم يغطي إعلان واحد الكمية كاملة لحاله.')}</p>
      <div className="space-y-1">
        <label htmlFor="alert-budget" className="block text-[13px] font-semibold">{tr('Total budget (SAR)', 'الميزانية الإجمالية (ر.س)')}</label>
        <input id="alert-budget" type="number" min="0" step="any" inputMode="decimal" className="field num" value={f.budget} disabled={f.freeOnly} onChange={(e) => set('budget')(e.target.value)} aria-invalid={touched && !!errors.budget} data-testid="input-alert-budget" />
        {errText('budget')}
      </div>
      <div className="space-y-1">
        <label htmlFor="alert-maxUnitPrice" className="block text-[13px] font-semibold">{tr('Max price per unit', 'أعلى سعر للوحدة')}</label>
        <input id="alert-maxUnitPrice" type="number" min="0" step="any" inputMode="decimal" className="field num" value={f.maxUnitPrice} disabled={f.freeOnly} onChange={(e) => set('maxUnitPrice')(e.target.value)} aria-invalid={touched && !!errors.maxUnitPrice} data-testid="input-alert-max-unit-price" />
        {errText('maxUnitPrice')}
      </div>
      <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-input px-3.5 text-sm font-semibold">
        <input type="checkbox" checked={f.freeOnly} onChange={(e) => set('freeOnly')(e.target.checked)} className="size-4 accent-[#075E54]" data-testid="checkbox-alert-free-only" />
        {tr('Free materials only', 'المواد المجانية فقط')}
      </label>
    </fieldset>

    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="mb-2 text-sm font-bold">{tr('Where and which kind', 'المكان والنوع')}</legend>
      <div className="col-span-2">{text('neighborhood', tr('Pickup neighborhood', 'حي الاستلام'), tr('e.g. Al Yasmin', 'مثال: الياسمين'))}</div>
      <div className="space-y-1">
        <label htmlFor="alert-category" className="block text-[13px] font-semibold">{tr('Category', 'الفئة')}</label>
        <select id="alert-category" className="field" value={f.categoryId} onChange={(e) => set('categoryId')(e.target.value)} data-testid="select-alert-category">
          <option value="">{tr('Any category', 'كل الفئات')}</option>
          {f.categoryId && !categories.data?.some((c) => c.id === f.categoryId) && <option value={f.categoryId}>{f.categoryId}</option>}
          {categories.data?.map((c) => <option key={c.id} value={c.id}>{tr(c.nameEn, c.nameAr)}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="alert-condition" className="block text-[13px] font-semibold">{tr('Condition', 'الحالة')}</label>
        <select id="alert-condition" className="field" value={f.condition} onChange={(e) => set('condition')(e.target.value)} data-testid="select-alert-condition">
          <option value="">{tr('Any condition', 'كل الحالات')}</option><option value="new">{tr('New', 'جديد')}</option><option value="like_new">{tr('Like new', 'شبه جديد')}</option><option value="used">{tr('Used', 'مستعمل')}</option>
        </select>
      </div>
    </fieldset>
    {errText('empty')}

    <div className="rounded-xl border border-border bg-background p-4">
      <p className="flex items-start gap-2.5 text-[14px] leading-6"><MessageCircle size={17} className="mt-1 shrink-0 text-primary" />
        <span data-testid="text-alert-delivery">إذا توفّر إعلان يناسب طلبك، بنرسل لك بطاقته في الرسائل.</span></p>
      {isLoaded && user ? <EmailOptIn checked={email} onChange={setEmail} status={emailStatus.data} loading={emailStatus.isLoading} error={emailStatus.isError} /> : <EmailOptIn checked={email} onChange={setEmail} guest />}
    </div>

    {save.isError && <p role="alert" className="flex items-center gap-2 text-[13px] font-medium text-destructive" data-testid="status-alert-save-error"><AlertCircle size={14} />{tr('The alert was not saved. Try again.', 'ما انحفظ التنبيه. حاول مرة ثانية.')}</p>}
    <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-border bg-card px-5 py-4">
      <Button className="flex-1" onClick={submit} disabled={save.isPending || (touched && invalid)} testId="button-save-alert">
        {save.isPending ? <><Spinner />{tr('Saving…', 'جارٍ الحفظ…')}</> : user || !isLoaded ? <><Check size={16} />{tr('Save alert', 'احفظ التنبيه')}</> : tr('Sign in to save', 'سجّل الدخول للحفظ')}
      </Button>
      <Button variant="outline" onClick={onClose} testId="button-cancel-alert">{tr('Cancel', 'إلغاء')}</Button>
    </div>
  </div>;
}

export function EmailOptIn({ checked, onChange, status, loading, error, guest }: {
  checked: boolean; onChange: (v: boolean) => void; status?: AlertEmailStatus; loading?: boolean; error?: boolean; guest?: boolean;
}) {
  const { tr } = useLang();
  const unavailable = status?.deliveryMode === 'unavailable';
  return <div className="mt-3 border-t border-border pt-3">
    <label className={cx('flex cursor-pointer items-center gap-3 text-sm font-semibold', unavailable && 'cursor-not-allowed opacity-60')}>
      <input type="checkbox" checked={checked} disabled={unavailable} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[#075E54]" data-testid="checkbox-alert-email" />
      <Mail size={16} className="text-muted-foreground" />أرسل لي التنبيه على الإيميل أيضًا
    </label>
    <div className="ms-7 mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
      {guest ? tr('Uses your verified account email after you sign in.', 'نستخدم بريد حسابك الموثّق بعد تسجيل الدخول.')
        : loading ? <span className="shimmer inline-block h-3 w-40 rounded" />
        : error || !status ? tr('Email status unavailable right now. Alerts still arrive in Messages.', 'تعذر التحقق من البريد الآن. التنبيهات بتوصل في الرسائل.')
        : <EmailStatusLine status={status} />}
    </div>
  </div>;
}

export function EmailStatusLine({ status }: { status: AlertEmailStatus }) {
  const { tr } = useLang();
  const { openUserProfile } = useClerk();
  return <div className="space-y-1.5" data-testid="status-alert-email">
    {status.maskedEmail && <p>{tr('Sent to', 'يُرسل إلى')} <bdi dir="ltr" className="font-semibold text-foreground" data-testid="text-masked-email">{status.maskedEmail}</bdi>
      {status.verified ? <span className="ms-1.5 text-success">· {tr('verified', 'موثّق')}</span> : <span className="ms-1.5 text-[#8a5a00]">· {tr('pending verification', 'بانتظار التوثيق')}</span>}</p>}
    {!status.verified && <p className="flex flex-wrap items-center gap-x-2">
      <span>{tr('The in-app alert saves right away. Email starts once your address is verified.', 'التنبيه داخل التطبيق ينحفظ فوراً، والإيميل يبدأ بعد توثيق بريدك.')}</span>
      <button type="button" onClick={() => openUserProfile()} className="font-semibold text-primary underline underline-offset-2" data-testid="button-verify-email">{tr('Verify email', 'وثّق بريدك')}</button></p>}
    {status.deliveryMode === 'local' && <p className="flex items-start gap-1.5 rounded-md bg-amber-soft px-2 py-1.5 text-[#5b4211]" data-testid="note-email-test-mode"><FlaskConical size={13} className="mt-0.5 shrink-0" />{tr('Test mode: emails are recorded locally for testing and are not sent to your inbox.', 'وضع تجريبي: رسائل البريد تُسجَّل محلياً للاختبار ولا تُرسل إلى بريدك.')}</p>}
    {status.deliveryMode === 'unavailable' && <p className="flex items-start gap-1.5" data-testid="note-email-unavailable"><ShieldAlert size={13} className="mt-0.5 shrink-0" />{tr('Email delivery is not available right now.', 'إرسال البريد غير متاح حالياً.')}</p>}
  </div>;
}

function SavedView({ alert, status, onClose }: { alert: AvailabilityAlert; status?: AlertEmailStatus; onClose: () => void }) {
  const { tr, num } = useLang();
  return <div className="text-center" data-testid="panel-alert-saved">
    <div className="pop mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={26} strokeWidth={2.6} /></div>
    <h2 className="text-xl font-bold" data-testid="text-alert-saved">تم حفظ التنبيه</h2>
    <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
      {alert.existing ? tr('You already had this search saved, so we kept the existing alert.', 'هذا البحث محفوظ عندك من قبل، فأبقينا التنبيه نفسه.') : tr('We will message you in Baqi Alerts the moment a listing fits.', 'بنراسلك في «تنبيهات باقي» أول ما يتوفّر إعلان يناسبك.')}
    </p>
    {alert.matchCount > 0 && <p className="mt-2 text-sm font-semibold text-primary num" data-testid="text-alert-match-count">{tr(`${num(alert.matchCount)} matching listing(s) already sent to Messages`, `أرسلنا ${num(alert.matchCount)} إعلان مطابق إلى الرسائل`)}</p>}
    <div className="mt-4 rounded-xl border border-border p-3 text-start"><CriteriaChips criteria={alert.criteria} testPrefix="chip-saved" /></div>
    {alert.emailEnabled && status && !status.verified && <p className="mt-3 rounded-lg bg-amber-soft p-2.5 text-start text-[12.5px] leading-5 text-[#5b4211]">{tr('Email is on for this search but will start after you verify your address.', 'البريد مفعّل لهذا البحث، ويبدأ بعد توثيق بريدك.')}</p>}
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <Link href="/account/alerts" className={btn('primary')} onClick={onClose} data-testid="link-manage-alerts-saved">إدارة تنبيهاتي</Link>
      <Button variant="outline" onClick={onClose} testId="button-alert-done">{tr('Done', 'تم')}</Button>
    </div>
  </div>;
}

/* ---------- small shared bits ---------- */

export function AlertStatusBadge({ status }: { status: 'active' | 'paused' | 'deleted' }) {
  const { tr } = useLang();
  const map = {
    active: ['bg-[#e4f3ea] text-success', tr('Active', 'نشط')],
    paused: ['bg-amber-soft text-[#6b4b0c]', tr('Paused', 'موقوف')],
    deleted: ['bg-muted text-muted-foreground', tr('Deleted', 'محذوف')],
  } as const;
  return <span className={cx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold', map[status][0])} data-testid="status-alert">
    <span className={cx('size-1.5 rounded-full', status === 'active' ? 'bg-success' : status === 'paused' ? 'bg-[#c88a12]' : 'bg-muted-foreground')} />{map[status][1]}</span>;
}

export function InlineNote({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <p className="flex items-start gap-2 text-[13px] leading-5 text-muted-foreground">{icon ?? <BellOff size={14} className="mt-0.5 shrink-0" />}{children}</p>;
}

export { RotateCcw as UndoIcon };
