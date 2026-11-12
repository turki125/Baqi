import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetListingQueryKey, getListConversationsQueryKey, getListOrdersQueryKey,
  useCreateConversation, useCreateOrder, useGetListing,
} from '@workspace/api-client-react';
import type { Listing } from '@workspace/api-client-react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, ExternalLink, Info, MapPin,
  Maximize2, MessageCircle, Minus, Pencil, Phone, Plus, Tag, Truck,
} from 'lucide-react';
import { useLang } from '../lang';
import {
  Badge, BackLink, Button, Card, ErrorState, ListingPhoto, Modal, PhotoFallback, PriceTag,
  SimulationNote, SkeletonRows, Spinner, cx, useConditionLabel, useMember,
} from '../ui';
import { REQ, basePath, clearPending, initials, photoUrl, readPending, reservationMath, savePending } from '@/lib/baqi';

function Gallery({ listing }: { listing: Listing }) {
  const { tr, num } = useLang();
  const photos = listing.photos ?? [];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const go = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  useEffect(() => {
    if (!open) return;
    const rtl = document.documentElement.dir === 'rtl';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
      if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!photos.length) return <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border"><PhotoFallback label={tr('The seller has not added photos', 'لم يضف البائع صوراً')} /></div>;
  return <div>
    <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
      <ListingPhoto key={photos[index]} src={photos[index]} alt={`${listing.title} ${index + 1}`} className="pop" />
      <button type="button" onClick={() => setOpen(true)} className="absolute bottom-3 end-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-card/95 px-3 text-sm font-semibold shadow-card hover:bg-card" data-testid="button-enlarge-photo">
        <Maximize2 size={16} />{tr('Enlarge', 'تكبير')}</button>
      {photos.length > 1 && <>
        <button type="button" onClick={() => go(-1)} aria-label={tr('Previous photo', 'الصورة السابقة')} className="absolute start-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-card hover:bg-card" data-testid="button-photo-prev"><ArrowLeft size={18} className="rtl-flip" /></button>
        <button type="button" onClick={() => go(1)} aria-label={tr('Next photo', 'الصورة التالية')} className="absolute end-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-card hover:bg-card" data-testid="button-photo-next"><ArrowRight size={18} className="rtl-flip" /></button>
        <span className="absolute start-3 top-3 rounded-md bg-foreground/75 px-2 py-0.5 text-xs font-semibold text-white num">{num(index + 1)} / {num(photos.length)}</span>
      </>}
    </div>
    {photos.length > 1 && <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" role="group" aria-label={tr('Photos', 'الصور')}>
      {photos.map((p, i) => <button key={p + i} type="button" onClick={() => setIndex(i)} aria-label={`${tr('Photo', 'صورة')} ${i + 1}`} aria-current={i === index}
        className={cx('size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-opacity', i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')} data-testid={`button-thumb-${i}`}>
        <ListingPhoto src={p} alt="" /></button>)}
    </div>}
    <Modal open={open} onOpenChange={setOpen} title={listing.title} description={`${tr('Photo', 'صورة')} ${num(index + 1)} / ${num(photos.length)}`} wide>
      <div className="relative">
        <img src={photoUrl(photos[index]) ?? ''} alt={`${listing.title} ${index + 1}`} className="mx-auto max-h-[70dvh] w-auto rounded-xl object-contain" />
        {photos.length > 1 && <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => go(-1)} aria-label={tr('Previous photo', 'الصورة السابقة')}><ArrowLeft size={18} className="rtl-flip" /></Button>
          <Button variant="outline" onClick={() => go(1)} aria-label={tr('Next photo', 'الصورة التالية')}><ArrowRight size={18} className="rtl-flip" /></Button>
        </div>}
      </div>
    </Modal>
  </div>;
}

type Stage = 'select' | 'review';

function ReservationPanel({ item, quantity, setQuantity, excessAccepted, setExcessAccepted, stage, setStage, onConfirm, busy, error, isOwner }: {
  item: Listing; quantity: number; setQuantity: (n: number) => void; excessAccepted: boolean; setExcessAccepted: (b: boolean) => void;
  stage: Stage; setStage: (s: Stage) => void; onConfirm: () => void; busy: boolean; error: string; isOwner: boolean;
}) {
  const { tr, num, money } = useLang();
  const quantityId = useId();
  const m = reservationMath(item, quantity);
  const step = item.minimumIncrement > 0 ? item.minimumIncrement : 1;
  const soldOut = item.quantity <= 0;
  const blocked = soldOut || m.invalid || m.exceedsStock || (m.hasExcess && !excessAccepted) || isOwner;
  const change = (n: number) => { setQuantity(Math.max(0, Math.min(item.quantity, n))); setExcessAccepted(false); };

  return <div className="space-y-4">
    <div>
      <PriceTag listing={item} size="lg" />
      <p className="mt-1 text-sm text-muted-foreground num">{num(item.quantity)} <bdi>{item.unit}</bdi> {tr('available', 'متاح')}</p>
    </div>
    {stage === 'select' ? <>
      <div>
        <label htmlFor={quantityId} className="text-sm font-semibold">{tr('Quantity', 'الكمية')}</label>
        {item.saleMode === 'full_lot' ? <div className="mt-1.5 rounded-xl bg-muted px-4 py-3 text-sm">
          <p className="font-semibold num">{num(item.quantity)} <bdi>{item.unit}</bdi></p>
          <p className="mt-0.5 text-muted-foreground">{tr('Sold as a full lot only. You reserve the whole quantity.', 'تُباع الكمية كاملة فقط. ستحجز الكمية بأكملها.')}</p>
        </div> : <>
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" onClick={() => change(quantity - step)} disabled={quantity <= step} className="grid size-11 place-items-center rounded-xl border border-input hover:bg-muted disabled:opacity-40" aria-label={tr('Decrease quantity', 'إنقاص الكمية')} data-testid="button-qty-decrease"><Minus size={17} /></button>
            <input id={quantityId} type="number" inputMode="decimal" min={0} max={item.quantity} step="any" value={quantity || ''} onChange={(e) => change(Number(e.target.value) || 0)}
              className="field num !w-28 text-center font-semibold" aria-describedby={`${quantityId}-hint`} data-testid="input-order-quantity" />
            <button type="button" onClick={() => change(quantity + step)} disabled={quantity + step > item.quantity + 1e-9} className="grid size-11 place-items-center rounded-xl border border-input hover:bg-muted disabled:opacity-40" aria-label={tr('Increase quantity', 'زيادة الكمية')} data-testid="button-qty-increase"><Plus size={17} /></button>
            <span className="text-sm text-muted-foreground"><bdi>{item.unit}</bdi></span>
          </div>
          <p id={`${quantityId}-hint`} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-5 text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0" />
            {tr(`Sold in steps of ${num(step)} ${item.unit}. Other amounts round up to the next step.`, `تُباع بمضاعفات ${num(step)} ${item.unit}. تُقرَّب الكميات الأخرى إلى المضاعف التالي.`)}</p>
        </>}
      </div>
      {m.hasExcess && !m.exceedsStock && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#f0d89f] bg-amber-soft p-3 text-[13px] leading-5 text-[#5b4211]">
        <input type="checkbox" checked={excessAccepted} onChange={(e) => setExcessAccepted(e.target.checked)} className="mt-0.5 size-4 accent-[#075E54]" data-testid="checkbox-accept-excess" />
        <span>{tr('Your quantity rounds up to', 'تُقرَّب كميتك إلى')} <strong className="num">{num(m.actualQuantity)} <bdi>{item.unit}</bdi></strong>. {tr('I agree to take this full quantity.', 'أوافق على استلام هذه الكمية كاملة.')}</span>
      </label>}
      {m.exceedsStock && <p role="alert" className="text-[13px] font-medium text-destructive">{tr('Not enough stock for the next sale step. Choose a smaller quantity.', 'المخزون لا يكفي للمضاعف التالي. اختر كمية أقل.')}</p>}
      <Summary item={item} m={m} />
      {isOwner ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{tr('This is your listing.', 'هذا إعلانك.')}</p> :
        <Button size="lg" className="w-full" disabled={blocked} onClick={() => setStage('review')} testId="button-review-reservation">
          {soldOut ? tr('No stock available', 'لا توجد كمية متاحة') : item.isFree ? tr('Review pickup request', 'راجع طلب الاستلام') : tr('Review reservation', 'راجع الحجز')}<ArrowRight size={17} className="rtl-flip" />
        </Button>}
    </> : <div className="rise space-y-4">
      <div className="rounded-xl border border-primary/25 bg-secondary/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.isFree ? tr('Pickup request', 'طلب استلام') : tr('Review reservation', 'مراجعة الحجز')}</p>
        <p className="mt-1 font-semibold">{item.title}</p>
      </div>
      <Summary item={item} m={m} />
      {item.isFree ? <p className="text-[13px] leading-5 text-muted-foreground">{tr('No payment is needed. After you send the request, arrange a pickup time with the seller in Messages.', 'لا حاجة للدفع. بعد إرسال الطلب، رتّب موعد الاستلام مع البائع عبر الرسائل.')}</p>
        : <SimulationNote>{tr('Next you will simulate the 10% deposit with Mada or card. No real money is charged.', 'ستقوم بعد ذلك بمحاكاة دفع عربون ١٠٪ عبر مدى أو البطاقة. لن يتم خصم أي مبلغ حقيقي.')}</SimulationNote>}
      {error && <p role="alert" className="rounded-xl bg-[#fdecea] p-3 text-sm font-medium text-destructive" data-testid="status-order-error">{error}</p>}
      <div className="grid gap-2">
        <Button size="lg" onClick={onConfirm} disabled={busy || blocked} testId="button-reserve-listing">
          {busy ? <><Spinner />{tr('Creating…', 'جارٍ الإنشاء…')}</> : item.isFree ? <><Truck size={17} />{tr('Send pickup request', 'أرسل طلب الاستلام')}</> : <>{tr('Confirm and continue to deposit', 'أكّد وتابع إلى العربون')}<ArrowRight size={17} className="rtl-flip" /></>}
        </Button>
        <Button variant="ghost" onClick={() => setStage('select')} disabled={busy} testId="button-edit-quantity">{tr('Change quantity', 'تعديل الكمية')}</Button>
      </div>
    </div>}
  </div>;

  function Summary({ item, m }: { item: Listing; m: ReturnType<typeof reservationMath> }) {
    return <dl className="space-y-2 rounded-xl bg-muted/70 p-4 text-sm num" data-testid="summary-reservation">
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{tr('Selected quantity', 'الكمية المختارة')}</dt><dd className="font-semibold">{num(m.actualQuantity)} <bdi>{item.unit}</bdi></dd></div>
      {!item.isFree && <>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{tr('Material total', 'قيمة المواد')}</dt><dd className="font-semibold">{money(m.total)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="font-semibold text-primary">{tr('Deposit due now (10%)', 'العربون المستحق الآن (١٠٪)')}</dt><dd className="font-bold text-primary">{money(m.deposit)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{tr('Balance at pickup', 'المتبقي عند الاستلام')}</dt><dd className="font-semibold">{money(m.balance)}</dd></div>
      </>}
      {item.isFree && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{tr('Price', 'السعر')}</dt><dd className="font-semibold text-success">{tr('Free', 'مجاناً')}</dd></div>}
    </dl>;
  }
}

export default function ListingPage() {
  const { id = '' } = useParams<{ id: string }>();
  const search = useSearch();
  const { tr, isAr, num, date } = useLang();
  const cond = useConditionLabel();
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useMember();
  const qc = useQueryClient();
  const listing = useGetListing(id, { query: { enabled: !!id, queryKey: getGetListingQueryKey(id) }, request: REQ });
  const createOrder = useCreateOrder({ request: REQ });
  const startConversation = useCreateConversation({ request: REQ });
  const [quantity, setQuantity] = useState(0);
  const [excessAccepted, setExcessAccepted] = useState(false);
  const [stage, setStage] = useState<Stage>('select');
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const restored = useRef(false);
  const item = listing.data;

  useEffect(() => {
    if (!item || restored.current) return;
    restored.current = true;
    const pending = readPending(item.id);
    if (pending && new URLSearchParams(search).get('review') === '1') {
      setQuantity(pending.quantity); setExcessAccepted(pending.excessAccepted); setStage('review');
      if (window.matchMedia('(max-width: 1023px)').matches) setSheet(true);
    } else {
      setQuantity(item.saleMode === 'full_lot' ? item.quantity : Math.min(item.quantity, item.minimumIncrement || 1));
    }
  }, [item, search]);

  if (listing.isLoading) return <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6"><div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"><div className="shimmer aspect-[4/3] rounded-2xl" /><SkeletonRows rows={3} /></div></main>;
  if (listing.isError || !item) return <main className="px-4 py-10"><ErrorState message={tr('This listing could not be loaded. It may have been removed.', 'تعذر تحميل هذا الإعلان. ربما تمت إزالته.')} retry={() => void listing.refetch()} /><div className="text-center"><Link href="/" className="text-sm font-semibold text-primary">{tr('Back to browse', 'العودة للتصفح')}</Link></div></main>;

  const isOwner = !!user && user.id === item.sellerId;
  const m = reservationMath(item, quantity);

  const confirm = () => {
    setError('');
    if (!isLoaded) return;
    if (!user) {
      savePending({ listingId: item.id, quantity, excessAccepted });
      setLocation(`/sign-in?redirect=${encodeURIComponent(`${basePath}/listing/${item.id}?review=1`)}`);
      return;
    }
    if (lock.current || createOrder.isPending) return;
    lock.current = true;
    createOrder.mutate({ data: { listingId: item.id, quantity: m.requestedQuantity, excessAccepted: !m.hasExcess || excessAccepted } }, {
      onSuccess: async (order) => {
        clearPending();
        await Promise.all([qc.invalidateQueries({ queryKey: getListOrdersQueryKey() }), qc.invalidateQueries({ queryKey: getGetListingQueryKey(item.id) })]);
        setLocation(`/orders/${order.id}?new=1`);
      },
      onError: () => {
        lock.current = false;
        setError(tr('We could not create this reservation. The quantity may have changed. Review it and try again.', 'تعذر إنشاء الحجز. ربما تغيرت الكمية المتاحة. راجعها وحاول مرة أخرى.'));
        void listing.refetch();
      },
    });
  };

  const messageSeller = () => {
    if (!user) { setLocation(`/sign-in?redirect=${encodeURIComponent(`${basePath}/listing/${item.id}`)}`); return; }
    if (startConversation.isPending) return;
    startConversation.mutate({ data: { listingId: item.id, initialMessage: isAr ? `مرحباً، لدي سؤال عن ${item.title}` : `Hello, I have a question about ${item.title}` } }, {
      onSuccess: async (c) => { await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() }); setLocation(`/messages/${c.id}`); },
    });
  };

  const panelProps = { item, quantity, setQuantity, excessAccepted, setExcessAccepted, stage, setStage, onConfirm: confirm, busy: createOrder.isPending || lock.current, error, isOwner };

  return <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
    <BackLink href="/">{tr('Back to browse', 'العودة للتصفح')}</BackLink>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-6">
        <Gallery listing={item} />
        <section>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="teal">{cond(item.condition)}</Badge>
            <Badge><Tag size={12} />{isAr ? item.categoryNameAr : item.categoryNameEn}</Badge>
            {item.isFree && <Badge tone="amber">{tr('Free', 'مجاني')}</Badge>}
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl" data-testid="text-listing-title">{item.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin size={15} /><bdi>{item.neighborhood}</bdi>{tr(', Riyadh', '، الرياض')}</span>
            <span className="flex items-center gap-1.5"><CalendarDays size={15} />{tr('Listed', 'نُشر')} {date(item.createdAt)}</span>
          </div>
          <div className="mt-3 lg:hidden"><PriceTag listing={item} size="lg" /></div>
        </section>
        <Card className="p-5">
          <h2 className="text-base font-semibold">{tr('Description', 'الوصف')}</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-foreground/85">{item.description}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold">{tr('Quantity and sale rules', 'الكمية وقواعد البيع')}</h2>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3 num">
            <div><dt className="text-muted-foreground">{tr('Available', 'المتاح')}</dt><dd className="mt-0.5 font-semibold">{num(item.quantity)} <bdi>{item.unit}</bdi></dd></div>
            <div><dt className="text-muted-foreground">{tr('Sale type', 'طريقة البيع')}</dt><dd className="mt-0.5 font-semibold">{item.saleMode === 'full_lot' ? tr('Full lot only', 'الكمية كاملة فقط') : tr('Partial quantities', 'كميات جزئية')}</dd></div>
            {item.saleMode === 'partial' && <div><dt className="text-muted-foreground">{tr('Minimum step', 'أقل مضاعف')}</dt><dd className="mt-0.5 font-semibold">{num(item.minimumIncrement)} <bdi>{item.unit}</bdi></dd></div>}
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold">{tr('Pickup', 'الاستلام')}</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-foreground/85">{item.pickupDetails}</p>
          {item.mapUrl && <a href={item.mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary" data-testid="link-map">{tr('Open pickup location in maps', 'افتح موقع الاستلام في الخرائط')}<ExternalLink size={14} /></a>}
          {isOwner && <Link href={`/sell?edit=${item.id}`} className="mt-3 flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary" data-testid="link-edit-listing"><Pencil size={14} />{tr('Update quantity or pickup details', 'تحديث الكمية أو تفاصيل الاستلام')}</Link>}
        </Card>
        <Card className="p-5">
          <h2 className="sr-only">{tr('Seller', 'البائع')}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-secondary text-base font-bold text-primary">{initials(item.sellerName)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold"><bdi>{item.sellerName}</bdi></p>
              {item.sellerTrusted ? <p className="mt-0.5 flex items-center gap-1 text-[13px] text-primary"><BadgeCheck size={14} />{tr('Trusted seller', 'بائع موثوق')}</p> : <p className="text-[13px] text-muted-foreground">{tr('Seller', 'البائع')}</p>}
            </div>
            {!isOwner && <Button variant="outline" onClick={messageSeller} disabled={startConversation.isPending} testId="button-message-seller">
              {startConversation.isPending ? <Spinner /> : <MessageCircle size={16} />}{tr('Message seller', 'راسل البائع')}</Button>}
          </div>
          {item.phoneVisible && item.sellerPhone && <a href={`tel:${item.sellerPhone}`} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary" data-testid="link-seller-phone"><Phone size={15} /><bdi dir="ltr">{item.sellerPhone}</bdi></a>}
          {startConversation.isError && <p role="alert" className="mt-3 text-sm text-destructive">{tr('Could not start the conversation. Try again.', 'تعذر بدء المحادثة. حاول مرة أخرى.')}</p>}
        </Card>
      </div>
      <aside className="hidden lg:block">
        <Card className="sticky top-[84px] p-5"><ReservationPanel {...panelProps} /></Card>
      </aside>
    </div>

    <div className="mobile-action fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card/97 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
        <div className="min-w-0"><PriceTag listing={item} /><p className="text-xs text-muted-foreground num">{num(item.quantity)} <bdi>{item.unit}</bdi> {tr('available', 'متاح')}</p></div>
        {isOwner ? <Link href={`/sell?edit=${item.id}`} className="text-sm font-semibold text-primary">{tr('Your listing', 'إعلانك')}</Link> :
          <Button size="lg" onClick={() => setSheet(true)} disabled={item.quantity <= 0} testId="button-open-reservation">{item.isFree ? tr('Request pickup', 'اطلب الاستلام') : tr('Reserve', 'احجز')}</Button>}
      </div>
    </div>
    <Modal open={sheet} onOpenChange={setSheet} side="bottom" title={item.isFree ? tr('Request free pickup', 'طلب استلام مجاني') : tr('Reserve this material', 'احجز هذه المادة')}>
      <ReservationPanel {...panelProps} />
      {stage === 'select' && <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground"><Check size={14} />{tr('You can review before anything is created.', 'يمكنك المراجعة قبل إنشاء أي طلب.')}</p>}
    </Modal>
  </main>;
}
