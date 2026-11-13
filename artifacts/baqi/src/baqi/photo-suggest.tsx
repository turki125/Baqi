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
  const lang = 'ar';
  const [location] = useLocation();
  const suggest = useSuggestListingDetails({ request: REQ });
  const [result, setResult] = useState<{ photo: string; lang: string; data: PhotoSuggestion } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState({ title: true, description: true, categoryId: true });
  const reqId = useRef(0);
  const lock = useRef(false);
  const autoRequested = useRef<string | null>(null);
  const requestContext = useRef({ photo, signedIn });
  const photoRef = useRef(photo);
  photoRef.current = photo;

  const run = () => {
    if (!photo || uploading || lock.current || !signedIn) return;
    lock.current = true; setBusy(true); setError(''); setResult(null);
    const id = ++reqId.current; const forPhoto = photo; const forLang = lang;
    suggest.mutateAsync({ id: 'draft', data: { objectPath: forPhoto, language: forLang } })
      .then((data) => {
        if (id !== reqId.current || photoRef.current !== forPhoto) return;
        setResult({ photo: forPhoto, lang: forLang, data });
        setPick({
          title: !current.title.trim() && !!data.title.trim(),
          description: !current.description.trim() && !!data.description.trim(),
          categoryId: !current.categoryId && !!data.categoryId,
        });
      })
      .catch((error: { status?: number }) => { if (id === reqId.current) setError(photoErrorMessage(error.status ?? 503, tr)); })
      .finally(() => { if (id === reqId.current) { lock.current = false; setBusy(false); } });
  };

  // A new cover photo invalidates stale results. Analyze once after its upload completes.
  useEffect(() => {
    if (requestContext.current.photo === photo && requestContext.current.signedIn === signedIn) return;
    requestContext.current = { photo, signedIn };
    reqId.current++;
    lock.current = false;
    autoRequested.current = null;
    setBusy(false);
    setError('');
    setResult(null);
  }, [photo, signedIn]);
  useEffect(() => {
    if (!photo || uploading || !signedIn || autoRequested.current === photo) return;
    autoRequested.current = photo;
    run();
  }, [photo, uploading, signedIn]);

  const live = result && result.photo === photo && result.lang === lang ? result.data : null;
  const cat = live && categories?.find((c) => c.id === live.categoryId);
  const currentCategory = current.categoryId && categories?.find((c) => c.id === current.categoryId);
  const canApply = {
    title: !!live?.title.trim() && !current.title.trim(),
    description: !!live?.description.trim() && !current.description.trim(),
    categoryId: !!cat && !current.categoryId,
  };
  const nothing = !((pick.title && canApply.title) || (pick.description && canApply.description) || (pick.categoryId && canApply.categoryId));
  const apply = () => {
    if (!live || nothing) return;
    onApply({
      title: pick.title && canApply.title ? live.title : undefined,
      description: pick.description && canApply.description ? live.description : undefined,
      categoryId: pick.categoryId && canApply.categoryId && cat ? live.categoryId! : undefined,
    });
    setResult(null);
  };
  const pct = live ? Math.round(live.confidence * 100) : 0;
  const rows = live ? [
    {
      key: 'title' as const, label: tr('Title', 'العنوان'),
      value: current.title.trim() || live.title || tr('No confident title suggestion', 'لا يوجد اقتراح موثوق للعنوان'),
      enabled: canApply.title,
      note: current.title.trim() ? tr('Your entry will be kept.', 'سيبقى ما كتبته كما هو.') : '',
    },
    {
      key: 'categoryId' as const, label: tr('Category', 'الفئة'),
      value: currentCategory ? (isAr ? currentCategory.nameAr : currentCategory.nameEn)
        : current.categoryId || (cat ? (isAr ? cat.nameAr : cat.nameEn) : tr('No confident category match', 'لا يوجد تطابق موثوق للفئة')),
      enabled: canApply.categoryId,
      note: current.categoryId ? tr('Your selection will be kept.', 'سيبقى اختيارك كما هو.') : '',
    },
    {
      key: 'description' as const, label: tr('Description', 'الوصف'),
      value: current.description.trim() || live.description || tr('No confident description suggestion', 'لا يوجد اقتراح موثوق للوصف'),
      enabled: canApply.description,
      note: current.description.trim() ? tr('Your entry will be kept.', 'سيبقى ما كتبته كما هو.') : '',
    },
  ] : [];

  return <section className="rounded-xl border border-border bg-secondary/50 p-4" aria-labelledby="suggest-h" data-testid="panel-photo-suggest">
    <div className="flex flex-wrap items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary"><ScanSearch size={18} /></span>
      <div className="min-w-0 flex-1">
        <h3 id="suggest-h" className="text-sm font-semibold">{tr('Draft details from your cover photo', 'اقترح التفاصيل من صورة الغلاف')}</h3>
        <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{tr('We suggest a short Arabic title, category and description. Review them before applying; your existing entries are kept.', 'نقترح عنواناً عربياً قصيراً وفئة ووصفاً. راجعها قبل التطبيق، وستبقى مدخلاتك الحالية كما هي.')}</p>
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
        <p className="text-[13px] text-muted-foreground">{tr('Arabic suggestions for this cover photo.', 'اقتراحات عربية لصورة الغلاف هذه.')} <span className="num font-semibold text-foreground" data-testid="text-suggest-confidence">{tr(`Model confidence ${pct}%`, `ثقة النموذج ${pct}٪`)}</span>{pct < 60 && <> · {tr('Low confidence, check carefully.', 'ثقة منخفضة، راجع بعناية.')}</>}</p>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(({ key, label, value, enabled, note }) => <label key={key} className={cx('flex gap-3 rounded-lg border p-3', pick[key] && enabled ? 'border-primary bg-secondary/60' : 'border-border', !enabled && 'opacity-70')}>
          <input type="checkbox" disabled={!enabled} checked={pick[key] && enabled} onChange={(e) => setPick((p) => ({ ...p, [key]: e.target.checked }))} className="mt-1 size-4 accent-primary" data-testid={`checkbox-suggest-${key}`} />
          <span className="min-w-0"><span className="block text-xs font-semibold text-muted-foreground">{label}</span><span className="block whitespace-pre-line text-sm" dir="auto" data-testid={`text-suggest-${key}`}>{value}</span>{note && <span className="mt-1 block text-xs text-muted-foreground">{note}</span>}</span>
        </label>)}
      </div>
      <p className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-muted-foreground"><ShieldAlert size={15} className="mt-0.5 shrink-0" />{tr('Confirm price, quantity, exact dimensions and pickup location yourself; a photo cannot verify them.', 'أدخل السعر والكمية والمقاسات الدقيقة وموقع الاستلام بنفسك؛ لا يمكن للصورة تأكيدها.')}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setResult(null)} testId="button-suggest-dismiss"><X size={14} />{tr('Dismiss', 'تجاهل')}</Button>
        <Button size="sm" onClick={apply} disabled={nothing} testId="button-suggest-apply"><Check size={14} />{tr('Apply selected', 'طبّق المحدد')}</Button>
      </div>
    </div>}
  </section>;
}
