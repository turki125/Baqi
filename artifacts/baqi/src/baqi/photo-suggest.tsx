import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useSuggestListingDetails } from '@workspace/api-client-react';
import type { Category, PhotoSuggestion } from '@workspace/api-client-react';
import { Check, LockKeyhole, RotateCcw, ScanSearch, ShieldAlert, X } from 'lucide-react';
import { useLang } from './lang';
import { Button, ListingPhoto, Spinner, btn, cx } from './ui';
import { REQ, signInHref } from '@/lib/baqi';
import { photoErrorMessage } from './photo-errors';

type Fields = { title?: string; description?: string; categoryId?: string };

export function PhotoSuggestPanel({ photo, uploading, signedIn, current, categories, onApply }: {
  photo?: string; uploading: boolean; signedIn: boolean;
  current: { title: string; description: string; categoryId: string };
  categories?: Category[]; onApply: (f: Fields) => void;
}) {
  const { tr, isAr } = useLang();
  const lang = isAr ? 'ar' : 'en';
  const [location] = useLocation();
  const suggest = useSuggestListingDetails({ request: REQ });
  const [result, setResult] = useState<{ photo: string; lang: string; data: PhotoSuggestion } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState({ title: true, description: true, categoryId: true });
  const [confirmReplace, setConfirmReplace] = useState(false);
  const reqId = useRef(0);
  const lock = useRef(false);
  const photoRef = useRef(photo);
  photoRef.current = photo;

  // Photo replaced/removed or language switched: invalidate pending and stale results.
  useEffect(() => { reqId.current++; lock.current = false; setBusy(false); setError(''); setResult(null); }, [photo, lang]);
  useEffect(() => () => { reqId.current++; }, []);

  const run = () => {
    if (!photo || uploading || lock.current || !signedIn) return;
    lock.current = true; setBusy(true); setError(''); setResult(null);
    const id = ++reqId.current; const forPhoto = photo; const forLang = lang;
    suggest.mutateAsync({ id: 'draft', data: { objectPath: forPhoto, language: forLang } })
      .then((data) => {
        if (id !== reqId.current || photoRef.current !== forPhoto) return;
        setResult({ photo: forPhoto, lang: forLang, data });
        setPick({ title: true, description: true, categoryId: !!data.categoryId });
        setConfirmReplace(false);
      })
      .catch((error: { status?: number }) => { if (id === reqId.current) setError(photoErrorMessage(error.status ?? 503, tr)); })
      .finally(() => { if (id === reqId.current) { lock.current = false; setBusy(false); } });
  };

  const live = result && result.photo === photo && result.lang === lang ? result.data : null;
  const cat = live && categories?.find((c) => c.id === live.categoryId);
  const overwrites = live ? [
    pick.title && current.title.trim() && current.title.trim() !== live.title.trim(),
    pick.description && current.description.trim() && current.description.trim() !== live.description.trim(),
  ].some(Boolean) : false;
  const nothing = !pick.title && !pick.description && !(pick.categoryId && cat);
  const apply = () => {
    if (!live || nothing || (overwrites && !confirmReplace)) return;
    onApply({ title: pick.title ? live.title : undefined, description: pick.description ? live.description : undefined, categoryId: pick.categoryId && cat ? live.categoryId : undefined });
    setResult(null);
  };
  const pct = live ? Math.round(live.confidence * 100) : 0;

  return <section className="rounded-xl border border-border bg-secondary/50 p-4" aria-labelledby="suggest-h" data-testid="panel-photo-suggest">
    <div className="flex flex-wrap items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary"><ScanSearch size={18} /></span>
      <div className="min-w-0 flex-1">
        <h3 id="suggest-h" className="text-sm font-semibold">{tr('Draft details from your cover photo', 'اقترح التفاصيل من صورة الغلاف')}</h3>
        <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{tr('Optional. You review every suggestion before anything changes. Condition, quantity and price are never touched.', 'اختياري. تراجع كل اقتراح قبل أي تغيير. لا تتأثر الحالة أو الكمية أو السعر.')}</p>
      </div>
      {!signedIn ? <Link href={signInHref(location)} className={btn('outline', 'sm')} data-testid="link-suggest-sign-in"><LockKeyhole size={14} />{tr('Sign in to use', 'سجّل الدخول للاستخدام')}</Link>
        : <Button size="sm" variant="outline" onClick={run} disabled={!photo || uploading || busy} testId="button-suggest-details">
          {busy ? <><Spinner />{tr('Reading photo…', 'جارٍ قراءة الصورة…')}</> : live ? <><RotateCcw size={14} />{tr('Suggest again', 'اقترح مجدداً')}</> : tr('Suggest details', 'اقترح التفاصيل')}</Button>}
    </div>
    {signedIn && !photo && <p className="mt-2 text-[13px] text-muted-foreground" data-testid="text-suggest-needs-photo">{tr('Add a photo first, or type the details yourself below.', 'أضف صورة أولاً، أو اكتب التفاصيل بنفسك أدناه.')}</p>}
    {signedIn && photo && uploading && <p className="mt-2 text-[13px] text-muted-foreground">{tr('Wait for uploads to finish.', 'انتظر حتى يكتمل الرفع.')}</p>}
    {busy && <div className="mt-3 space-y-2" aria-busy><div className="shimmer h-4 w-2/3 rounded" /><div className="shimmer h-3 w-full rounded" /><div className="shimmer h-3 w-4/5 rounded" /></div>}
    {error && <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#fdecea] p-3 text-[13px] font-medium text-destructive" data-testid="status-suggest-error">
      <span className="flex-1">{error} {tr('You can keep typing manually.', 'يمكنك متابعة الكتابة يدوياً.')}</span>
      <Button size="sm" variant="outline" onClick={run} testId="button-suggest-retry"><RotateCcw size={14} />{tr('Try again', 'أعد المحاولة')}</Button></div>}
    {live && <div className="pop mt-4 rounded-xl border border-border bg-card p-4" data-testid="card-suggestion">
      <div className="flex gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border"><ListingPhoto src={result?.photo} alt="" /></div>
        <p className="text-[13px] text-muted-foreground">{tr('Suggestion for this cover photo.', 'اقتراح لصورة الغلاف هذه.')} <span className="num font-semibold text-foreground" data-testid="text-suggest-confidence">{tr(`Model confidence ${pct}%`, `ثقة النموذج ${pct}٪`)}</span>{pct < 60 && <> · {tr('Low confidence, check carefully.', 'ثقة منخفضة، راجع بعناية.')}</>}</p>
      </div>
      <div className="mt-3 space-y-2">
        {([
          ['title', tr('Title', 'العنوان'), live.title, true],
          ['categoryId', tr('Category', 'الفئة'), cat ? (isAr ? cat.nameAr : cat.nameEn) : tr('No matching category', 'لا توجد فئة مطابقة'), !!cat],
          ['description', tr('Description', 'الوصف'), live.description, true],
        ] as const).map(([k, label, val, ok]) => <label key={k} className={cx('flex gap-3 rounded-lg border p-3', pick[k] && ok ? 'border-primary bg-secondary/60' : 'border-border', !ok && 'opacity-60')}>
          <input type="checkbox" disabled={!ok} checked={pick[k] && ok} onChange={(e) => { setPick((p) => ({ ...p, [k]: e.target.checked })); setConfirmReplace(false); }} className="mt-1 size-4 accent-primary" data-testid={`checkbox-suggest-${k}`} />
          <span className="min-w-0"><span className="block text-xs font-semibold text-muted-foreground">{label}</span><span className="block whitespace-pre-line text-sm" dir="auto" data-testid={`text-suggest-${k}`}>{val}</span></span>
        </label>)}
      </div>
      {overwrites && <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-soft p-3 text-[13px] text-[#5b4211]">
        <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} className="mt-0.5 size-4 accent-primary" data-testid="checkbox-confirm-replace" />
        {tr('Replace the title or description I already typed.', 'استبدل العنوان أو الوصف الذي كتبته.')}</label>}
      <p className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-muted-foreground"><ShieldAlert size={15} className="mt-0.5 shrink-0" />{tr('Inspect the material and confirm sizes, brand and quantity yourself. A photo cannot verify them.', 'افحص المادة وتأكد بنفسك من المقاسات والعلامة والكمية. الصورة لا تثبتها.')}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setResult(null)} testId="button-suggest-dismiss"><X size={14} />{tr('Dismiss', 'تجاهل')}</Button>
        <Button size="sm" onClick={apply} disabled={nothing || (overwrites && !confirmReplace)} testId="button-suggest-apply"><Check size={14} />{tr('Apply selected', 'طبّق المحدد')}</Button>
      </div>
    </div>}
  </section>;
}
