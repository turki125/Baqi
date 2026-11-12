import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useListCategories, useListListings } from '@workspace/api-client-react';
import { ArrowRight, Camera, ImageIcon, RotateCcw, HandCoins, MessageCircle, Search, SlidersHorizontal, Truck, X } from 'lucide-react';
import { useLang } from '../lang';
import { Button, EmptyState, ErrorState, ListingCard, Modal, SkeletonGrid, btn, cx, useMember } from '../ui';
import { REQ } from '@/lib/baqi';
import { PhotoSearchDialog, useImageSearch, type PhotoSearch } from '../image-search';
import { photoErrorMessage } from '../photo-errors';

type Condition = '' | 'new' | 'like_new' | 'used';
type Sort = 'newest' | 'price_low' | 'price_high';

export default function CatalogPage() {
  const { tr, isAr, num } = useLang();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState<Condition>('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const [drawer, setDrawer] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const listRef = useRef<HTMLElement>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photo, setPhoto] = useState<PhotoSearch | null>(null);
  const img = useImageSearch();
  const { user } = useMember();
  useEffect(() => {
    img.reset(); setPhoto(null); setPhotoOpen(false);
  }, [user?.id]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQuery(input.trim()), 300);
    return () => window.clearTimeout(timer.current);
  }, [input]);

  const params = useMemo(() => ({ q: query || undefined, category: category || undefined, condition: condition || undefined, freeOnly: freeOnly || undefined, sort }), [query, category, condition, freeOnly, sort]);
  const listings = useListListings(params, { request: REQ });
  const categories = useListCategories({ request: REQ });

  const baseFilters = useMemo(() => ({ q: query || undefined, categoryId: category || undefined, condition: condition || undefined, freeOnly: freeOnly || undefined, sort }), [query, category, condition, freeOnly, sort]);
  const imgKey = photo ? img.keyOf(photo, baseFilters) : '';
  const imgStale = !!photo && !!img.state && img.state.key !== imgKey;
  const imgActive = !!photo;
  const runPhoto = (p: PhotoSearch) => { setPhoto(p); setPhotoOpen(false); img.run(p, baseFilters); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const clearPhoto = () => { img.reset(); setPhoto(null); };
  const catName = (id: string) => { const c = categories.data?.find((x) => x.id === id); return c ? (isAr ? c.nameAr : c.nameEn) : id; };
  const condLabel = (c: Condition) => c === 'new' ? tr('New', 'جديد') : c === 'like_new' ? tr('Like new', 'شبه جديد') : tr('Used', 'مستعمل');
  const sortLabel = (s: Sort) => s === 'newest' ? tr('Newest first', 'الأحدث أولاً') : s === 'price_low' ? tr('Lowest price', 'الأقل سعراً') : tr('Highest price', 'الأعلى سعراً');
  const chips = [
    query && { key: 'q', label: `“${query}”`, clear: () => { setInput(''); setQuery(''); } },
    category && { key: 'cat', label: catName(category), clear: () => setCategory('') },
    condition && { key: 'cond', label: condLabel(condition), clear: () => setCondition('') },
    freeOnly && { key: 'free', label: tr('Free only', 'مجاني فقط'), clear: () => setFreeOnly(false) },
    sort !== 'newest' && { key: 'sort', label: sortLabel(sort), clear: () => setSort('newest') },
    photo && { key: 'photo', label: tr('Photo match', 'مطابقة بالصورة') + (photo.minQuantity ? ` · ${num(photo.minQuantity)} ${photo.unit}` : ''), clear: clearPhoto },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearAll = () => { clearPhoto(); setInput(''); setQuery(''); setCategory(''); setCondition(''); setFreeOnly(false); setSort('newest'); };
  const filterCount = (condition ? 1 : 0) + (freeOnly ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const pickCategory = (id: string) => { setCategory(id); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

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
      <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="size-4 accent-[#075E54]" data-testid="checkbox-free-only" />
      {tr('Free materials only', 'المواد المجانية فقط')}
    </label>
  </div>;

  return <main>
    <section className="border-b border-border bg-card">
      <div className="mx-auto max-w-[1240px] px-4 pb-7 pt-8 sm:px-6 sm:pt-12">
        <p className="mb-3 inline-flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">{tr('Riyadh · local pickup', 'الرياض · استلام محلي')}</p>
        <h1 className="max-w-3xl text-[30px] font-bold leading-[1.15] tracking-tight sm:text-[42px]">{tr('Build for less. Give surplus a second life.', 'ابنِ بتكلفة أقل. وامنح فائض المواد فرصة جديدة.')}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground sm:text-base">{tr('Buy leftover building materials from sites and homes across Riyadh, sell what you no longer need, or give it away to someone who can use it. Pickup is arranged directly with the seller.', 'اشترِ فائض مواد البناء من المواقع والمنازل في الرياض، أو بِع ما لم تعد تحتاجه، أو تبرّع به لمن يستفيد منه. يتم ترتيب الاستلام مباشرة مع البائع.')}</p>
        <form role="search" onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-6 flex max-w-3xl gap-2">
          <label htmlFor="search" className="sr-only">{tr('Search materials', 'ابحث عن المواد')}</label>
          <div className="relative flex-1">
            <Search size={20} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input id="search" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr('Tiles, cement, timber, rebar…', 'بلاط، أسمنت، خشب، حديد تسليح…')}
              className="field !min-h-[54px] !ps-12 text-base" data-testid="input-search-listings" />
          </div>
          <button type="button" onClick={() => setPhotoOpen(true)} className={btn('outline', 'lg')} aria-label={tr('Search with a photo', 'ابحث بصورة')} data-testid="button-open-photo-search"><Camera size={18} /><span className="hidden sm:inline">{tr('Photo', 'صورة')}</span></button>
          <button type="submit" className={btn('primary', 'lg')} data-testid="button-search">{tr('Search', 'بحث')}</button>
        </form>
        {categories.data && categories.data.length > 0 && <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={tr('Categories', 'الفئات')}>
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
          <h2 id="listings-heading" className="text-xl font-bold">{category ? catName(category) : tr('Available materials', 'المواد المتاحة')}</h2>
          <p className="text-sm text-muted-foreground num" aria-live="polite" data-testid="text-listing-count">
            {imgActive ? (img.busy ? tr('Comparing photos…', 'جارٍ مقارنة الصور…') : img.state?.data && !imgStale ? `${num(img.state.data.length)} ${tr('visual matches', 'مطابقة بصرية')}` : tr('Photo search', 'بحث بالصورة')) : listings.isLoading ? tr('Searching…', 'جارٍ البحث…') : `${num(listings.data?.length ?? 0)} ${tr('results', 'نتيجة')}`}</p>
        </div>
        <Button variant="outline" className="md:hidden" onClick={() => setDrawer(true)} testId="button-open-filters">
          <SlidersHorizontal size={16} />{tr('Filters & sort', 'التصفية والترتيب')}{filterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{num(filterCount)}</span>}
        </Button>
        <div className="hidden md:block">{filterControls(false)}</div>
      </div>
      {chips.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-2" aria-label={tr('Active filters', 'عوامل التصفية النشطة')}>
        {chips.map((c) => <button key={c.key} type="button" onClick={c.clear} className="pop inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-[13px] font-semibold text-primary hover:bg-[#dcebe8]" data-testid={`chip-filter-${c.key}`} aria-label={`${tr('Remove filter', 'إزالة')} ${c.label}`}>
          {c.label}<X size={14} /></button>)}
        <button type="button" onClick={clearAll} className="min-h-8 rounded-lg px-2 text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="button-clear-filters">{tr('Clear filters', 'مسح التصفية')}</button>
      </div>}
      {imgActive ? renderPhotoResults() : listings.isLoading ? <SkeletonGrid count={8} /> : listings.isError ? <ErrorState retry={() => void listings.refetch()} /> :
        listings.data && listings.data.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{listings.data.map((l, i) => <div key={l.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}><ListingCard listing={l} /></div>)}</div> :
        <EmptyState title={chips.length ? tr('No materials match these filters', 'لا توجد مواد تطابق هذه الخيارات') : tr('No materials listed yet', 'لا توجد مواد معروضة بعد')}
          body={chips.length ? tr('Try a broader search or remove a filter.', 'جرّب بحثاً أوسع أو أزل أحد الخيارات.') : tr('Be the first to list surplus materials in Riyadh.', 'كن أول من يعرض فائض مواد في الرياض.')}
          action={chips.length ? <Button variant="outline" onClick={clearAll} testId="button-empty-clear">{tr('Clear filters', 'مسح التصفية')}</Button> : <Link href="/sell" className={btn('primary')}>{tr('Sell materials', 'بِع موادك')}</Link>} />}
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
    <PhotoSearchDialog key={user?.id ?? 'guest'} open={photoOpen} onOpenChange={setPhotoOpen} initial={photo} onSearch={runPhoto} />
  </main>;

  function renderPhotoResults() {
    const note = <p className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-[13px] leading-5 text-muted-foreground" data-testid="note-photo-scope"><ImageIcon size={15} className="mt-0.5 shrink-0" />{tr('Ranked from up to 12 recent photo listings that meet your filters; sort applies among matches. Visual similarity does not prove size, model or grade.', 'مرتبة من بين ما يصل إلى ١٢ إعلاناً حديثاً بصور تطابق خياراتك، ويُطبّق الترتيب على المطابقات. التشابه البصري لا يثبت المقاس أو الطراز أو الدرجة.')}</p>;
    if (img.busy) return <>{note}<SkeletonGrid count={4} /></>;
    if (imgStale || !img.state) return <>{note}<div className="rounded-2xl border border-dashed border-input bg-card px-6 py-10 text-center" data-testid="status-photo-stale">
      <p className="font-semibold">{tr('Filters changed since the last photo search', 'تغيّرت الخيارات منذ آخر بحث بالصورة')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr('Run the photo search again to see matches for these filters.', 'أعد البحث بالصورة لعرض المطابقات لهذه الخيارات.')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={() => photo && img.run(photo, baseFilters)} testId="button-photo-refine"><RotateCcw size={15} />{tr('Search again', 'ابحث مجدداً')}</Button><Button variant="outline" onClick={clearPhoto} testId="button-photo-clear-stale">{tr('Clear photo', 'إزالة الصورة')}</Button></div></div></>;
    if (img.state.error) return <>{note}<ErrorState message={photoErrorMessage(img.state.error, tr)} retry={() => photo && img.run(photo, baseFilters)} />
      <div className="flex justify-center"><Button variant="outline" onClick={clearPhoto} testId="button-photo-error-clear">{tr('Back to regular results', 'العودة للنتائج العادية')}</Button></div></>;
    const data = img.state.data ?? [];
    if (!data.length) return <>{note}<EmptyState title={tr('No similar materials found', 'لم نجد مواد مشابهة')} body={tr('Try a clearer photo, a smaller quantity, or fewer filters.', 'جرّب صورة أوضح أو كمية أقل أو خيارات أقل.')} action={<div className="flex gap-2"><Button variant="outline" onClick={() => setPhotoOpen(true)} testId="button-photo-empty-edit">{tr('Change photo', 'تغيير الصورة')}</Button><Button onClick={clearPhoto} testId="button-photo-empty-clear">{tr('Clear photo', 'إزالة الصورة')}</Button></div>} /></>;
    return <>{note}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-photo-results">{data.map((l, i) => <div key={l.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}><ListingCard listing={l} /></div>)}</div></>;
  }
}
