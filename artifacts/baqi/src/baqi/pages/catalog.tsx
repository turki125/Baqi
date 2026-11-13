import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useInterpretTextSearch, useListCategories, useListListings, type SearchCriteria } from '@workspace/api-client-react';
import { ArrowRight, Camera, ImageIcon, RotateCcw, HandCoins, MessageCircle, Search, SlidersHorizontal, Truck, X } from 'lucide-react';
import { useLang } from '../lang';
import { Button, EmptyState, ErrorState, ListingCard, Modal, SkeletonGrid, btn, cx, useMember } from '../ui';
import { basePath, REQ } from '@/lib/baqi';
import { PhotoSearchDialog, useImageSearch, type PhotoSearch } from '../image-search';
import { photoErrorMessage } from '../photo-errors';
import { AlertEditor, AlertPrompt, hasSearchCriteria, useRestoreAlertIntent, type AlertDraft } from '../alerts';
import type { AlertSearchInput } from '@workspace/api-client-react';

type Condition = '' | 'new' | 'like_new' | 'used';
type Sort = 'newest' | 'price_low' | 'price_high';

export default function CatalogPage() {
  const { tr, isAr, num } = useLang();
  const [input, setInput] = useState(() => new URLSearchParams(window.location.search).get('q')?.slice(0, 300) ?? '');
  const [query, setQuery] = useState(() => (new URLSearchParams(window.location.search).get('q') ?? '').trim().slice(0, 300));
  const [alertDraft, setAlertDraft] = useState<AlertDraft | null>(null);
  useRestoreAlertIntent('availability-alert', 'restore', setAlertDraft);
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState<Condition>('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [textBusy, setTextBusy] = useState(false);
  const [textFallback, setTextFallback] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photo, setPhoto] = useState<PhotoSearch | null>(null);
  const img = useImageSearch();
  const { user } = useMember();
  const interpret = useInterpretTextSearch({ request: REQ });
  useEffect(() => {
    img.reset(); setPhoto(null); setPhotoOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (img.state?.criteria && !img.busy) setCriteria(img.state.criteria);
  }, [img.state?.key, img.state?.criteria, img.busy]);

  const params = useMemo(() => ({
    q: criteria ? undefined : query || undefined,
    searchTermsEn: criteria?.termsEn.length ? criteria.termsEn : undefined,
    searchTermsAr: criteria?.termsAr.length ? criteria.termsAr : undefined,
    category: category || criteria?.categoryId || undefined,
    condition: condition || criteria?.condition || undefined,
    freeOnly: freeOnly ? true : criteria?.freeOnly ?? undefined,
    minQuantity: criteria?.minQuantity ?? undefined,
    unit: criteria?.unit ?? undefined,
    sort,
  }), [criteria, query, category, condition, freeOnly, sort]);
  const listings = useListListings(params, { request: REQ });
  const categories = useListCategories({ request: REQ });

  const baseFilters = useMemo(() => ({
    q: criteria ? undefined : query || undefined,
    searchTermsEn: criteria?.termsEn.length ? criteria.termsEn : undefined,
    searchTermsAr: criteria?.termsAr.length ? criteria.termsAr : undefined,
    categoryId: category || criteria?.categoryId || undefined,
    condition: condition || criteria?.condition || undefined,
    freeOnly: freeOnly ? true : criteria?.freeOnly ?? undefined,
    minQuantity: criteria?.minQuantity ?? undefined,
    unit: criteria?.unit ?? undefined,
    sort,
  }), [criteria, query, category, condition, freeOnly, sort]);
  const imgKey = photo ? img.keyOf(photo, baseFilters) : '';
  const imgStale = !!photo && !!img.state && img.state.key !== imgKey;
  const imgActive = !!photo;
  const textAlertSearch: AlertSearchInput = { q: query || undefined, categoryId: category || undefined, condition: condition || undefined, freeOnly: freeOnly || undefined };
  const photoAlertSearch: AlertSearchInput | null = photo ? { ...textAlertSearch, objectPath: photo.objectPath, minQuantity: photo.minQuantity, unit: photo.minQuantity ? photo.unit : undefined } : null;
  const runPhoto = (p: PhotoSearch) => {
    setPhoto(p); setPhotoOpen(false);
    const filters = p.queryText?.trim()
      ? { categoryId: category || undefined, condition: condition || undefined, freeOnly: freeOnly || undefined, sort }
      : baseFilters;
    img.run(p, filters);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const clearPhoto = () => { img.reset(); setPhoto(null); };
  const catName = (id: string) => { const c = categories.data?.find((x) => x.id === id); return c ? (isAr ? c.nameAr : c.nameEn) : id; };
  const condLabel = (c: Condition) => c === 'new' ? tr('New', 'جديد') : c === 'like_new' ? tr('Like new', 'شبه جديد') : tr('Used', 'مستعمل');
  const sortLabel = (s: Sort) => s === 'newest' ? tr('Newest first', 'الأحدث أولاً') : s === 'price_low' ? tr('Lowest price', 'الأقل سعراً') : tr('Highest price', 'الأعلى سعراً');
  const headingCategory = category || criteria?.categoryId;
  const chips = [
    query && { key: 'q', label: `“${query}”`, clear: () => { setInput(''); setQuery(''); setCriteria(null); setTextFallback(false); } },
    category && { key: 'cat', label: catName(category), clear: () => setCategory('') },
    condition && { key: 'cond', label: condLabel(condition), clear: () => setCondition('') },
    freeOnly && { key: 'free', label: tr('Free only', 'مجاني فقط'), clear: () => setFreeOnly(false) },
    sort !== 'newest' && { key: 'sort', label: sortLabel(sort), clear: () => setSort('newest') },
    photo && { key: 'photo', label: tr('Photo match', 'مطابقة بالصورة') + (photo.minQuantity ? ` · ${num(photo.minQuantity)} ${photo.unit}` : ''), clear: clearPhoto },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearAll = () => { clearPhoto(); setInput(''); setQuery(''); setCriteria(null); setTextFallback(false); setCategory(''); setCondition(''); setFreeOnly(false); setSort('newest'); };
  const filterCount = (condition ? 1 : 0) + (freeOnly ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const pickCategory = (id: string) => { setCategory(id); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const submitTextSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitted = input.trim();
    if (!submitted) {
      setQuery(''); setCriteria(null); setTextFallback(false);
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (textBusy) return;
    setTextBusy(true); setTextFallback(false);
    try {
      const result = await interpret.mutateAsync({ data: { query: submitted } });
      const c = result.criteria;
      const hasCriteria = c.termsEn.length > 0 || c.termsAr.length > 0 || !!c.categoryId || !!c.minQuantity || !!c.dimensions || !!c.condition || c.freeOnly !== null;
      setQuery(submitted);
      setCriteria(hasCriteria ? c : null);
      setTextFallback(!hasCriteria);
    } catch {
      setQuery(submitted);
      setCriteria(null);
      setTextFallback(true);
    } finally {
      setTextBusy(false);
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filterControls = (stacked: boolean) => <div className={cx('flex gap-3', stacked ? 'flex-col' : 'flex-wrap items-end')}>
    <div className={stacked ? '' : 'w-44'}>
      <label htmlFor={`cond-${stacked}`} className="mb-1 block text-xs font-semibold text-muted-foreground">{tr('Condition', 'الحالة')}</label>
      <select id={`cond-${stacked}`} value={condition} onChange={(e) => setCondition(e.target.value as Condition)} className="field" data-testid="select-condition">
        <option value="">{tr('Any condition', 'كل الحالات')}</option><option value="new">{condLabel('new')}</option><option value="like_new">{condLabel('like_new')}</option><option value="used">{condLabel('used')}</option>
      </select>
    </div>
    <div className={stacked ? '' : 'w-48'}>
      <label htmlFor={`sort-${stacked}`} className="mb-1 block text-xs font-semibold text-muted-foreground">{tr('Sort by', 'الترتيب')}</label>
      <select id={`sort-${stacked}`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field" data-testid="select-sort">
        {(['newest', 'price_low', 'price_high'] as Sort[]).map((s) => <option key={s} value={s}>{sortLabel(s)}</option>)}
      </select>
    </div>
    <label className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border border-input bg-card px-4 text-sm font-semibold">
      <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="size-4 accent-primary" data-testid="checkbox-free-only" />
      {tr('Free materials only', 'المواد المجانية فقط')}
    </label>
  </div>;

  return <main>
    <section className="overflow-hidden border-b border-border bg-[#F3F2EC]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-4 px-4 pb-8 pt-7 sm:px-6 sm:pb-12 lg:min-h-[570px] lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] lg:gap-8 lg:px-10 lg:py-10">
        <div className="relative z-10 min-w-0 max-w-full lg:py-10">
        <p className="technical-label mb-5 flex items-center gap-3 text-muted-foreground"><span className="h-px w-9 bg-primary" />{tr('Riyadh / material exchange / 01', 'الرياض / تبادل المواد / ٠١')}</p>
        <h1 className="w-full min-w-0 max-w-full break-words text-[30px] font-bold leading-[1.12] tracking-tight sm:max-w-3xl sm:text-[42px] lg:text-[54px]">
          <span className="brand-type block max-w-full text-[1.42em] leading-[1.1]" lang="ar" dir="rtl">باقي <span className="text-[#F45A24]">فيه خير</span></span>
          <span className="mt-2 block max-w-full">{tr('Good materials. A new beginning.', 'مواد جيدة. بداية جديدة.')}</span>
        </h1>
        <p className="mt-4 w-full max-w-xl break-words text-[15px] leading-7 text-muted-foreground sm:text-base">{tr('Buy leftover building materials from sites and homes across Riyadh, sell what you no longer need, or give it away to someone who can use it. Pickup is arranged directly with the seller.', 'اشترِ فائض مواد البناء من المواقع والمنازل في الرياض، أو بِع ما لم تعد تحتاجه، أو تبرّع به لمن يستفيد منه. يتم ترتيب الاستلام مباشرة مع البائع.')}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px] font-medium text-muted-foreground">
          <span className="flex items-center gap-2 border-e border-border pe-3"><span className="size-2 rounded-full bg-primary" />{tr('Local pickup in Riyadh', 'استلام محلي في الرياض')}</span>
          <span>{tr('Reuse starts nearby', 'إعادة الاستخدام تبدأ من هنا')}</span>
        </div>
        </div>
        <div className="relative min-w-0">
          <div className="material-stage surface-grid mx-auto w-full max-w-[640px] rounded-sm" dir="ltr" role="group" aria-label={tr('A sculptural arrangement of limestone, timber and chrome', 'تكوين فني من الحجر والخشب والكروم')}>
            <img className="material-piece tiles" src={`${basePath}/demo-tiles.jpg`} alt={tr('Stack of reusable limestone tiles', 'رصّة بلاط حجري قابل لإعادة الاستخدام')} />
            <img className="material-piece timber" src={`${basePath}/demo-timber.jpg`} alt={tr('Reusable timber boards', 'ألواح خشب قابلة لإعادة الاستخدام')} />
            <span aria-hidden="true" className="material-piece chrome" />
            <span className="technical-label absolute start-3 top-3 z-10 bg-[#F3F2EC]/90 px-2 py-1 text-muted-foreground">{tr('Material study / Riyadh', 'دراسة المواد / الرياض')}</span>
            <span className="technical-label absolute bottom-3 end-3 z-10 bg-[#F3F2EC]/90 px-2 py-1 text-muted-foreground">24°42′ N — 46°40′ E</span>
          </div>
        </div>
      </div>
    </section>

    <section className="catalog-search-section border-b border-border bg-card" aria-label={tr('Search and browse materials', 'ابحث وتصفح المواد')}>
      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          <span>{tr('Local pickup in Riyadh', 'استلام محلي في الرياض')}</span>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <span>{tr('Reuse starts nearby', 'إعادة الاستخدام تبدأ من هنا')}</span>
        </div>
        <form role="search" onSubmit={(e) => { void submitTextSearch(e); }}
          className="catalog-search-form grid w-full max-w-[890px] grid-cols-[minmax(0,1fr)_auto_auto] gap-2 max-[480px]:grid-cols-[minmax(0,1fr)_auto]">
          <label htmlFor="search" className="sr-only">{tr('Search materials', 'ابحث عن المواد')}</label>
          <div className="relative min-w-0 max-[480px]:col-span-2">
            <Search size={20} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input id="search" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr('Tiles, cement, timber, rebar…', 'بلاط، أسمنت، خشب، حديد تسليح…')}
              className="field !min-h-[54px] !ps-12 text-base" data-testid="input-search-listings" />
          </div>
          <button type="button" onClick={() => setPhotoOpen(true)} className={cx(btn('outline', 'lg'), 'max-[480px]:col-start-1')} aria-label={tr('Search with a photo', 'ابحث بصورة')} data-testid="button-open-photo-search"><Camera size={18} /><span className="hidden sm:inline">{tr('Photo', 'صورة')}</span></button>
          <button type="submit" disabled={textBusy} className={btn('primary', 'lg')} data-testid="button-search">{textBusy ? tr('Understanding…', 'جارٍ الفهم…') : tr('Search', 'بحث')}</button>
        </form>
        {textFallback && <p role="status" className="mt-2 max-w-[890px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900" data-testid="note-ai-search-fallback">
          {tr('Smart search is unavailable right now. Showing regular text results; you can also use filters.', 'البحث الذكي غير متاح الآن. نعرض نتائج البحث النصي المعتاد، ويمكنك استخدام عوامل التصفية.')}
        </p>}
        {categories.data && categories.data.length > 0 && <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" aria-label={tr('Categories', 'الفئات')}>
          <button type="button" onClick={() => pickCategory('')} aria-pressed={!category} className={cx('shrink-0 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors', !category ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')} data-testid="button-category-all">{tr('All materials', 'كل المواد')}</button>
          {categories.data.map((c) => <button key={c.id} type="button" onClick={() => pickCategory(category === c.id ? '' : c.id)} aria-pressed={category === c.id}
            className={cx('shrink-0 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors', category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')} data-testid={`button-category-${c.id}`}>{isAr ? c.nameAr : c.nameEn}</button>)}
        </div>}
        {categories.isLoading && <div className="mt-5 flex gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-9 w-24 rounded-lg" />)}</div>}
        {categories.isError && <ErrorState message={tr('Categories could not be loaded.', 'تعذر تحميل الفئات.')} retry={() => void categories.refetch()} />}
      </div>
    </section>

    <section ref={listRef} className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-8 sm:px-6" aria-labelledby="listings-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="listings-heading" className="text-xl font-bold">{headingCategory ? catName(headingCategory) : tr('Available materials', 'المواد المتاحة')}</h2>
          <p className="text-sm text-muted-foreground num" aria-live="polite" data-testid="text-listing-count">
            {imgActive ? (img.busy ? tr('Comparing photos…', 'جارٍ مقارنة الصور…') : img.state?.data && !imgStale ? `${num(img.state.data.length)} ${tr('visual matches', 'مطابقة بصرية')}` : tr('Photo search', 'بحث بالصورة')) : listings.isLoading ? tr('Searching…', 'جارٍ البحث…') : `${num(listings.data?.length ?? 0)} ${tr('results', 'نتيجة')}`}</p>
        </div>
        <Button variant="outline" className="md:hidden" onClick={() => setDrawer(true)} testId="button-open-filters">
          <SlidersHorizontal size={16} />{tr('Filters & sort', 'التصفية والترتيب')}{filterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{num(filterCount)}</span>}
        </Button>
        <div className="hidden md:block">{filterControls(false)}</div>
      </div>
      {chips.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-2" aria-label={tr('Active filters', 'عوامل التصفية النشطة')}>
        {chips.map((c) => <button key={c.key} type="button" onClick={c.clear} className="pop inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-[13px] font-semibold text-primary hover:bg-[#f3e4dc]" data-testid={`chip-filter-${c.key}`} aria-label={`${tr('Remove filter', 'إزالة')} ${c.label}`}>
          {c.label}<X size={14} /></button>)}
        <button type="button" onClick={clearAll} className="min-h-8 rounded-lg px-2 text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="button-clear-filters">{tr('Clear filters', 'مسح التصفية')}</button>
      </div>}
      {imgActive ? renderPhotoResults() : listings.isLoading ? <SkeletonGrid count={8} /> : listings.isError ? <ErrorState retry={() => void listings.refetch()} /> :
        listings.data && listings.data.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{listings.data.map((l, i) => <div key={l.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}><ListingCard listing={l} /></div>)}</div> :
        <EmptyState title={chips.length ? tr('No materials match these filters', 'لا توجد مواد تطابق هذه الخيارات') : tr('No materials listed yet', 'لا توجد مواد معروضة بعد')}
          body={chips.length ? tr('Try a broader search or remove a filter.', 'جرّب بحثاً أوسع أو أزل أحد الخيارات.') : tr('Be the first to list surplus materials in Riyadh.', 'كن أول من يعرض فائض مواد في الرياض.')}
          action={chips.length ? <Button variant="outline" onClick={clearAll} testId="button-empty-clear">{tr('Clear filters', 'مسح التصفية')}</Button> : <Link href="/sell" className={btn('primary')}>{tr('Sell materials', 'بِع موادك')}</Link>} />}
      {!imgActive && listings.isSuccess && listings.data.length === 0 && hasSearchCriteria(textAlertSearch) && <AlertPrompt key={JSON.stringify(textAlertSearch)} search={textAlertSearch} onPreview={setAlertDraft} />}
    </section>

    <section className="border-y border-border bg-card" aria-labelledby="how-heading">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        <h2 id="how-heading" className="text-xl font-bold">{tr('How it works', 'كيف يعمل باقي')}</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
          {[
            { icon: Search, t: tr('Find what you need', 'اعثر على ما تحتاجه'), d: tr('Search by material, category or condition. Every listing shows quantity, neighborhood and price per unit.', 'ابحث حسب المادة أو الفئة أو الحالة. يظهر في كل إعلان الكمية والحي وسعر الوحدة.') },
            { icon: MessageCircle, t: tr('Ask and reserve', 'اسأل واحجز'), d: tr('Message the seller, then reserve with a 10% deposit. Free items only need a pickup request.', 'راسل البائع ثم احجز بعربون ١٠٪. المواد المجانية تحتاج طلب استلام فقط.') },
            { icon: Truck, t: tr('Pick up locally', 'استلم محلياً'), d: tr('Collect from the seller in Riyadh, confirm receipt, then settle the balance.', 'استلم من البائع في الرياض، أكّد الاستلام، ثم سدّد المبلغ المتبقي.') },
          ].map((s, i) => <li key={i} className="flex gap-4 rounded-2xl border border-border p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><s.icon size={19} /></span>
            <div><p className="font-semibold"><span className="text-muted-foreground num">{i + 1}. </span>{s.t}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{s.d}</p></div>
          </li>)}
        </ol>
        <p className="mt-4 text-[13px] text-muted-foreground">{tr('Deposits and payments in this version are simulations. No real money moves.', 'العربون والمدفوعات في هذه النسخة محاكاة. لا تنتقل أموال حقيقية.')}</p>
      </div>
    </section>

    <section className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-5 rounded-2xl bg-primary px-6 py-8 text-primary-foreground sm:flex-row sm:items-center sm:px-8">
        <div className="flex gap-4">
          <span className="hidden size-12 shrink-0 place-items-center rounded-xl bg-white/12 sm:grid"><HandCoins size={22} /></span>
          <div><h2 className="text-xl font-bold">{tr('Have leftover materials?', 'لديك مواد فائضة؟')}</h2>
            <p className="mt-1 max-w-xl text-[15px] leading-6 text-white/85">{tr('List them in three short steps. Sell by the unit, as a full lot, or give them away for free.', 'اعرضها في ثلاث خطوات قصيرة. بِع بالوحدة أو الكمية كاملة أو قدّمها مجاناً.')}</p></div>
        </div>
        <Link href="/sell" className={cx(btn('accent', 'lg'), 'shrink-0')} data-testid="link-sell-cta"><Camera size={18} />{tr('Sell materials', 'بِع موادك')}<ArrowRight size={17} className="rtl-flip" /></Link>
      </div>
    </section>

    <Modal open={drawer} onOpenChange={setDrawer} title={tr('Filters & sort', 'التصفية والترتيب')} side="bottom">
      {filterControls(true)}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => { setCondition(''); setFreeOnly(false); setSort('newest'); }} testId="button-drawer-reset">{tr('Reset', 'إعادة ضبط')}</Button>
        <Button onClick={() => setDrawer(false)} testId="button-drawer-apply">{tr('Show results', 'عرض النتائج')} {!imgActive && listings.data ? `(${num(listings.data.length)})` : ''}</Button>
      </div>
    </Modal>
    <AlertEditor draft={alertDraft} onClose={() => setAlertDraft(null)} returnTo="/?availability-alert=restore" />
    <PhotoSearchDialog key={user?.id ?? 'guest'} open={photoOpen} onOpenChange={setPhotoOpen} initial={photo} initialQueryText={input} onSearch={runPhoto} />
  </main>;

  function renderPhotoResults() {
    const visibleAttributes = img.state?.attributes
      ? [img.state.attributes.material, img.state.attributes.color, img.state.attributes.pattern, img.state.attributes.finish].filter((value): value is string => !!value)
      : [];
    const note = <p className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-[13px] leading-5 text-muted-foreground" data-testid="note-photo-scope">
      <ImageIcon size={15} className="mt-0.5 shrink-0" />
      <span>
        {tr('Ranked from up to 12 recent photo listings that meet your filters; sort applies among matches. Visual similarity does not prove size, model or grade.', 'مرتبة من بين ما يصل إلى ١٢ إعلاناً حديثاً بصور تطابق خياراتك، ويُطبّق الترتيب على المطابقات. التشابه البصري لا يثبت المقاس أو الطراز أو الدرجة.')}
        {visibleAttributes.length > 0 && <span className="mt-1 block font-semibold text-foreground" data-testid="text-photo-visible-attributes">{tr('Visible in your photo:', 'ظاهر في صورتك:')} {visibleAttributes.join(' · ')}</span>}
      </span>
    </p>;
    if (img.busy) return <>{note}<SkeletonGrid count={4} /></>;
    if (imgStale || !img.state) return <>{note}<div className="rounded-2xl border border-dashed border-input bg-card px-6 py-10 text-center" data-testid="status-photo-stale">
      <p className="font-semibold">{tr('Filters changed since the last photo search', 'تغيّرت الخيارات منذ آخر بحث بالصورة')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr('Run the photo search again to see matches for these filters.', 'أعد البحث بالصورة لعرض المطابقات لهذه الخيارات.')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={() => photo && img.run(photo, baseFilters)} testId="button-photo-refine"><RotateCcw size={15} />{tr('Search again', 'ابحث مجدداً')}</Button><Button variant="outline" onClick={clearPhoto} testId="button-photo-clear-stale">{tr('Clear photo', 'إزالة الصورة')}</Button></div></div></>;
    if (img.state.error) return <>{note}<ErrorState message={photoErrorMessage(img.state.error, tr)} retry={() => photo && img.run(photo, baseFilters)} />
      <div className="flex justify-center"><Button variant="outline" onClick={clearPhoto} testId="button-photo-error-clear">{tr('Back to regular results', 'العودة للنتائج العادية')}</Button></div></>;
    const data = img.state.data ?? [];
    if (!data.length) return <>{note}<EmptyState title={tr('No similar materials found', 'لم نجد مواد مشابهة')} body={tr('Try a clearer photo, a smaller quantity, or fewer filters.', 'جرّب صورة أوضح أو كمية أقل أو خيارات أقل.')} action={<div className="flex gap-2"><Button variant="outline" onClick={() => setPhotoOpen(true)} testId="button-photo-empty-edit">{tr('Change photo', 'تغيير الصورة')}</Button><Button onClick={clearPhoto} testId="button-photo-empty-clear">{tr('Clear photo', 'إزالة الصورة')}</Button></div>} />
      {photoAlertSearch && <AlertPrompt key={imgKey} search={photoAlertSearch} onPreview={setAlertDraft} />}</>;
    return <>{note}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-photo-results">{data.map((l, i) => <div key={l.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}><ListingCard listing={l} /></div>)}</div></>;
  }
}
