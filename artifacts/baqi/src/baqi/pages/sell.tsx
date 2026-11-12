import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetListingQueryKey, getListListingsQueryKey, useCreateListing, useGetListing, useListCategories,
  useRequestUploadUrl, useUpdateListing,
} from '@workspace/api-client-react';
import type { Listing, ListingInput } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, LockKeyhole, MapPin, X } from 'lucide-react';
import { useLang } from '../lang';
import { BackLink, Button, Card, ErrorState, Field, ListingPhoto, PageTitle, PriceTag, Protected, SkeletonRows, Spinner, btn, cx, useConditionLabel, useMember } from '../ui';
import { PhotoSuggestPanel } from '../photo-suggest';
import { DRAFT_KEY, REQ, signInHref } from '@/lib/baqi';

type Draft = {
  title: string; description: string; categoryId: string; condition: 'new' | 'like_new' | 'used';
  photos: string[]; quantity: string; unit: string; customUnit: string; price: string; free: boolean;
  saleMode: 'partial' | 'full_lot'; minimumIncrement: string; neighborhood: string; pickupDetails: string;
  mapUrl: string; phone: string; phoneVisible: boolean;
};
const empty: Draft = {
  title: '', description: '', categoryId: '', condition: 'used', photos: [], quantity: '', unit: 'piece', customUnit: '',
  price: '', free: false, saleMode: 'partial', minimumIncrement: '1', neighborhood: '', pickupDetails: '', mapUrl: '', phone: '', phoneVisible: false,
};
const UNITS = ['piece', 'bag', 'box', 'sheet', 'roll', 'm', 'm²', 'm³', 'ton', 'kg', 'pallet'];
type Errors = Partial<Record<keyof Draft, string>>;

function loadDraft(): Draft {
  try { return { ...empty, ...(JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') as Partial<Draft>) }; } catch { return empty; }
}

export default function SellPage() {
  const search = useSearch();
  const editId = new URLSearchParams(search).get('edit') || '';
  return editId ? <Protected><EditListing id={editId} /></Protected> : <CreateWizard />;
}

function unitLabel(u: string, tr: (en: string, ar: string) => string) {
  const map: Record<string, [string, string]> = {
    piece: ['piece', 'قطعة'], bag: ['bag', 'كيس'], box: ['box', 'كرتون'], sheet: ['sheet', 'لوح'], roll: ['roll', 'لفة'],
    m: ['metre (m)', 'متر'], 'm²': ['square metre (m²)', 'متر مربع'], 'm³': ['cubic metre (m³)', 'متر مكعب'], ton: ['ton', 'طن'], kg: ['kg', 'كجم'], pallet: ['pallet', 'منصة'],
  };
  const v = map[u];
  return v ? tr(v[0], v[1]) : u;
}

function CreateWizard() {
  const { tr, isAr, num, money } = useLang();
  const cond = useConditionLabel();
  const { user, isLoaded } = useMember();
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();
  const categories = useListCategories({ request: REQ });
  const create = useCreateListing({ request: REQ });
  const upload = useRequestUploadUrl({ request: REQ });
  const [d, setD] = useState<Draft>(loadDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const lock = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }, [d]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const unit = d.unit === 'custom' ? d.customUnit.trim() : d.unit;

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (d.title.trim().length < 2) e.title = tr('Add a short title (at least 2 characters).', 'أضف عنواناً قصيراً (حرفان على الأقل).');
      if (!d.categoryId) e.categoryId = tr('Choose a category.', 'اختر الفئة.');
      if (d.description.trim().length < 2) e.description = tr('Describe the material (size, colour, brand, condition).', 'صف المادة (المقاس، اللون، العلامة، الحالة).');
    }
    if (s === 1) {
      const q = Number(d.quantity);
      if (!Number.isFinite(q) || !(q > 0)) e.quantity = tr('Enter a quantity greater than zero.', 'أدخل كمية أكبر من صفر.');
      if (!unit) e.customUnit = tr('Enter a unit.', 'أدخل الوحدة.');
      if (!d.free && (d.price.trim() === '' || !Number.isFinite(Number(d.price)) || !(Number(d.price) > 0))) e.price = tr('Enter a price greater than zero, or choose Give away.', 'أدخل سعراً أكبر من صفر أو اختر التبرع.');
      if (d.saleMode === 'partial') {
        const inc = Number(d.minimumIncrement);
        if (!Number.isFinite(inc) || !(inc > 0)) e.minimumIncrement = tr('Enter a step greater than zero.', 'أدخل مضاعفاً أكبر من صفر.');
        else if (q > 0 && inc > q) e.minimumIncrement = tr('The step cannot be larger than the quantity.', 'لا يمكن أن يكون المضاعف أكبر من الكمية.');
      }
    }
    if (s === 2) {
      if (!d.neighborhood.trim()) e.neighborhood = tr('Enter the Riyadh neighborhood for pickup.', 'أدخل حي الاستلام في الرياض.');
      if (!d.pickupDetails.trim()) e.pickupDetails = tr('Explain when and how buyers can collect.', 'اشرح متى وكيف يمكن للمشتري الاستلام.');
      if (d.mapUrl.trim() && !/^https?:\/\//i.test(d.mapUrl.trim())) e.mapUrl = tr('Use a full link starting with https://', 'استخدم رابطاً كاملاً يبدأ بـ https://');
    }
    return e;
  };
  const go = (to: number) => {
    if (to > step) {
      const e = validate(step);
      setErrors(e);
      if (Object.keys(e).length) { const first = Object.keys(e)[0]; document.getElementById(`f-${first}`)?.focus(); return; }
    }
    setStep(to); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onFiles = async (files: FileList | null) => {
    setUploadError('');
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setUploadError(tr('Use JPEG, PNG or WebP images up to 10 MB.', 'استخدم صور JPEG أو PNG أو WebP بحجم لا يتجاوز 10 ميغابايت.'));
        continue;
      }
      try {
        const signed = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' } });
        const put = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!put.ok) throw new Error(String(put.status));
        setD((p) => ({ ...p, photos: [...p.photos, signed.objectPath] }));
      } catch {
        setUploadError(tr('A photo could not be uploaded. Check your connection and try again.', 'تعذر رفع إحدى الصور. تحقق من الاتصال وحاول مرة أخرى.'));
      }
    }
    setUploading(false);
  };

  const publish = (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    for (const s of [0, 1, 2]) { const errs = validate(s); if (Object.keys(errs).length) { setErrors(errs); setStep(s); return; } }
    if (!user) return;
    if (lock.current || create.isPending) return;
    lock.current = true;
    const body: ListingInput = {
      title: d.title.trim(), description: d.description.trim(), categoryId: d.categoryId, condition: d.condition,
      quantity: Number(d.quantity), unit, unitPrice: d.free ? null : Number(d.price), isFree: d.free,
      neighborhood: d.neighborhood.trim(), pickupDetails: d.pickupDetails.trim(), mapUrl: d.mapUrl.trim() || null,
      photos: d.photos, phone: d.phone.trim() || null, phoneVisible: d.phoneVisible && !!d.phone.trim(),
      saleMode: d.saleMode, minimumIncrement: d.saleMode === 'full_lot' ? Number(d.quantity) : Number(d.minimumIncrement),
    };
    create.mutate({ data: body }, {
      onSuccess: async (created) => {
        sessionStorage.removeItem(DRAFT_KEY);
        await qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
        setLocation(`/listing/${created.id}`);
      },
      onError: (error) => {
        lock.current = false;
        if ((error as { data?: { code?: string } }).data?.code === 'PHOTO_REUPLOAD_REQUIRED') {
          setStep(0);
          setUploadError(tr('Remove and re-upload any older or unavailable photos. Your other details are saved.', 'أزل الصور القديمة أو غير المتاحة وأعد رفعها. بقية تفاصيلك محفوظة.'));
          top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        setSubmitError(tr('Your listing could not be published. Your details are saved; try again.', 'تعذر نشر الإعلان. تفاصيلك محفوظة، حاول مرة أخرى.'));
      },
    });
  };

  const steps = [tr('Photos & details', 'الصور والتفاصيل'), tr('Quantity & price', 'الكمية والسعر'), tr('Pickup & review', 'الاستلام والمراجعة')];
  const preview: Listing = {
    id: 'preview', title: d.title || tr('Untitled material', 'مادة بلا عنوان'), description: d.description, categoryId: d.categoryId,
    categoryNameEn: categories.data?.find((c) => c.id === d.categoryId)?.nameEn ?? '', categoryNameAr: categories.data?.find((c) => c.id === d.categoryId)?.nameAr ?? '',
    condition: d.condition, quantity: Number(d.quantity) || 0, unit: unit || '-', unitPrice: d.free ? null : Number(d.price) || 0, isFree: d.free,
    neighborhood: d.neighborhood, pickupDetails: d.pickupDetails, mapUrl: d.mapUrl || null, photos: d.photos, sellerId: '', sellerName: user?.name ?? '',
    sellerTrusted: false, sellerPhone: d.phone || null, phoneVisible: d.phoneVisible, saleMode: d.saleMode, minimumIncrement: Number(d.minimumIncrement) || 1, createdAt: new Date().toISOString(),
  };
  const err = (k: keyof Draft) => errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `f-${k}-error` } : {};
  const signedOutBanner = isLoaded && !user && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
    <LockKeyhole size={18} className="text-primary" /><p className="flex-1">{tr('You can fill in the details now. Sign in to upload photos and publish. Your draft stays on this device.', 'يمكنك تعبئة التفاصيل الآن. سجّل الدخول لرفع الصور والنشر. تبقى مسودتك محفوظة على هذا الجهاز.')}</p>
    <Link href={signInHref(location)} className={btn('primary', 'sm')} data-testid="link-sell-sign-in">{tr('Sign in', 'تسجيل الدخول')}</Link>
  </div>;

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6" ref={top}>
    <PageTitle title={tr('Sell or give away materials', 'بِع موادك أو تبرّع بها')} subtitle={tr('Three short steps. Clear photos and honest quantities get faster pickups.', 'ثلاث خطوات قصيرة. الصور الواضحة والكميات الدقيقة تسرّع الاستلام.')} />
    <ol className="mb-6 grid grid-cols-3 gap-2" aria-label={tr('Progress', 'التقدم')}>
      {steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined}>
        <button type="button" onClick={() => (i < step ? go(i) : i === step + 1 ? go(i) : undefined)} className="w-full text-start" data-testid={`button-step-${i + 1}`}>
          <span className={cx('block h-1.5 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-border')} />
          <span className={cx('mt-2 flex items-center gap-1.5 text-[13px] font-semibold', i === step ? 'text-foreground' : 'text-muted-foreground')}>
            <span className={cx('grid size-5 shrink-0 place-items-center rounded-full text-[11px]', i < step ? 'bg-primary text-primary-foreground' : i === step ? 'border-2 border-primary text-primary' : 'border border-input')}>{i < step ? <Check size={12} /> : num(i + 1)}</span>
            <span className="hidden sm:inline">{s}</span></span>
        </button>
      </li>)}
    </ol>
    <p className="mb-4 text-sm font-semibold sm:hidden">{tr('Step', 'الخطوة')} {num(step + 1)}/{num(3)} · {steps[step]}</p>
    {signedOutBanner}
    {categories.isError && <ErrorState retry={() => void categories.refetch()} message={tr('Material categories could not be loaded.', 'تعذر تحميل فئات المواد.')} />}
    <form onSubmit={publish} noValidate>
      <Card className="rise p-5 sm:p-6" key={step}>
        {step === 0 && <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold">{tr('Photos', 'الصور')}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{tr('Show the full stack and a close-up of labels or damage. The first photo becomes the cover.', 'أظهر الكمية كاملة وصورة قريبة للملصقات أو أي عيوب. الصورة الأولى تصبح الغلاف.')}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {d.photos.map((p, i) => <div key={p} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                <ListingPhoto src={p} alt={`${tr('Photo', 'صورة')} ${i + 1}`} />
                {i === 0 && <span className="absolute start-1.5 top-1.5 rounded bg-foreground/75 px-1.5 text-[11px] font-semibold text-white">{tr('Cover', 'الغلاف')}</span>}
                <button type="button" onClick={() => set('photos', d.photos.filter((x) => x !== p))} aria-label={tr('Remove photo from draft', 'إزالة الصورة من المسودة')} className="absolute end-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-card/95 shadow-card hover:bg-card" data-testid={`button-remove-photo-${i}`}><X size={15} /></button>
              </div>)}
              <label className={cx('flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary', (!user || uploading) && 'pointer-events-none opacity-50')}>
                {uploading ? <Spinner /> : <ImagePlus size={22} />}{uploading ? tr('Uploading…', 'جارٍ الرفع…') : tr('Add photos', 'أضف صوراً')}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!user || uploading} onChange={(e) => { void onFiles(e.target.files); e.currentTarget.value = ''; }} data-testid="input-listing-photo" />
              </label>
            </div>
            {uploadError && <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">{uploadError}</p>}
            {!d.photos.length && <p className="mt-2 text-[13px] text-muted-foreground">{tr('Photos are optional, but listings without them show a plain placeholder.', 'الصور اختيارية، لكن الإعلانات بدونها تظهر بصورة بديلة بسيطة.')}</p>}
          </div>
          <PhotoSuggestPanel key={user?.id ?? 'guest'} photo={d.photos[0]} uploading={uploading} signedIn={!!user} categories={categories.data}
            current={{ title: d.title, description: d.description, categoryId: d.categoryId }}
            onApply={(f) => { setD((p) => ({ ...p, ...(f.title !== undefined && { title: f.title }), ...(f.description !== undefined && { description: f.description }), ...(f.categoryId !== undefined && { categoryId: f.categoryId }) })); setErrors((e) => ({ ...e, title: undefined, description: undefined, categoryId: undefined })); }} />
          <Field label={tr('Title', 'العنوان')} htmlFor="f-title" error={errors.title} hint={tr('e.g. 40 bags Portland cement 50 kg, 18 m² porcelain tiles 60×60', 'مثال: ٤٠ كيس أسمنت بورتلاندي ٥٠ كجم، ١٨ م² بلاط بورسلان ٦٠×٦٠')}>
            <input id="f-title" value={d.title} onChange={(e) => set('title', e.target.value)} className="field" dir="auto" {...err('title')} data-testid="input-listing-title" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr('Category', 'الفئة')} htmlFor="f-categoryId" error={errors.categoryId}>
              <select id="f-categoryId" value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="field" {...err('categoryId')} data-testid="select-listing-category">
                <option value="">{categories.isLoading ? tr('Loading…', 'جارٍ التحميل…') : tr('Choose a category', 'اختر الفئة')}</option>
                {categories.data?.map((c) => <option key={c.id} value={c.id}>{isAr ? c.nameAr : c.nameEn}</option>)}
              </select>
            </Field>
            <Field label={tr('Condition', 'الحالة')} htmlFor="f-condition">
              <select id="f-condition" value={d.condition} onChange={(e) => set('condition', e.target.value as Draft['condition'])} className="field" data-testid="select-listing-condition">
                <option value="new">{cond('new')}</option><option value="like_new">{cond('like_new')}</option><option value="used">{cond('used')}</option>
              </select>
            </Field>
          </div>
          <Field label={tr('Description', 'الوصف')} htmlFor="f-description" error={errors.description} hint={tr('Include dimensions, colour, brand, packaging and anything a buyer should know.', 'اذكر المقاسات واللون والعلامة التجارية والتغليف وأي شيء يجب أن يعرفه المشتري.')}>
            <textarea id="f-description" value={d.description} onChange={(e) => set('description', e.target.value)} className="field" dir="auto" {...err('description')} data-testid="input-listing-description" />
          </Field>
        </div>}

        {step === 1 && <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{tr('How are you offering it?', 'كيف تعرض المادة؟')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: false, t: tr('Sell', 'بيع'), s: tr('Set a price per unit', 'حدّد سعر الوحدة') }, { v: true, t: tr('Give away', 'تبرّع'), s: tr('Free pickup, no payment', 'استلام مجاني بلا دفع') }].map((o) =>
                <label key={String(o.v)} className={cx('cursor-pointer rounded-xl border p-3.5 transition-colors', d.free === o.v ? 'border-primary bg-secondary' : 'border-input hover:bg-muted')}>
                  <input type="radio" name="free" checked={d.free === o.v} onChange={() => set('free', o.v)} className="sr-only" data-testid={o.v ? 'radio-listing-free' : 'radio-listing-sell'} />
                  <span className="block text-sm font-semibold">{o.t}</span><span className="block text-[13px] text-muted-foreground">{o.s}</span>
                </label>)}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr('Total quantity available', 'إجمالي الكمية المتاحة')} htmlFor="f-quantity" error={errors.quantity}>
              <input id="f-quantity" type="number" inputMode="decimal" min="0" step="any" value={d.quantity} onChange={(e) => set('quantity', e.target.value)} className="field num" {...err('quantity')} data-testid="input-listing-quantity" />
            </Field>
            <Field label={tr('Unit', 'الوحدة')} htmlFor="f-unit" error={errors.customUnit} hint={tr('The unit buyers count in, and the unit your price applies to.', 'الوحدة التي يحسب بها المشتري ويُطبق عليها السعر.')}>
              <select id="f-unit" value={UNITS.includes(d.unit) ? d.unit : 'custom'} onChange={(e) => set('unit', e.target.value)} className="field" data-testid="select-listing-unit">
                {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u, tr)}</option>)}
                <option value="custom">{tr('Other unit…', 'وحدة أخرى…')}</option>
              </select>
              {(d.unit === 'custom' || !UNITS.includes(d.unit)) && <input id="f-customUnit" value={d.unit === 'custom' ? d.customUnit : d.unit} onChange={(e) => { set('unit', 'custom'); set('customUnit', e.target.value); }} placeholder={tr('e.g. bundle', 'مثال: حزمة')} className="field mt-2" aria-label={tr('Custom unit', 'وحدة مخصصة')} {...err('customUnit')} data-testid="input-listing-unit" />}
            </Field>
          </div>
          {!d.free && <Field label={tr(`Price per ${unit ? unitLabel(unit, tr) : 'unit'} (SAR)`, `السعر لكل ${unit ? unitLabel(unit, tr) : 'وحدة'} (ر.س)`)} htmlFor="f-price" error={errors.price}
            hint={Number(d.price) > 0 && Number(d.quantity) > 0 ? tr(`Whole stock value: ${money(Number(d.price) * Number(d.quantity))}`, `قيمة الكمية كاملة: ${money(Number(d.price) * Number(d.quantity))}`) : tr('Price for one unit, not the whole stock.', 'سعر الوحدة الواحدة وليس الكمية كاملة.')}>
            <input id="f-price" type="number" inputMode="decimal" min="0" step=".01" value={d.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" className="field num" {...err('price')} data-testid="input-listing-price" />
          </Field>}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{tr('Can buyers take part of it?', 'هل يمكن شراء جزء منها؟')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[{ v: 'partial' as const, t: tr('Yes, partial quantities', 'نعم، كميات جزئية'), s: tr('Buyers choose how much, in steps you set.', 'يختار المشتري الكمية بمضاعفات تحددها.') }, { v: 'full_lot' as const, t: tr('No, full lot only', 'لا، الكمية كاملة فقط'), s: tr('One buyer takes everything.', 'مشترٍ واحد يأخذ الكمية كلها.') }].map((o) =>
                <label key={o.v} className={cx('cursor-pointer rounded-xl border p-3.5 transition-colors', d.saleMode === o.v ? 'border-primary bg-secondary' : 'border-input hover:bg-muted')}>
                  <input type="radio" name="saleMode" checked={d.saleMode === o.v} onChange={() => set('saleMode', o.v)} className="sr-only" data-testid={`radio-sale-mode-${o.v}`} />
                  <span className="block text-sm font-semibold">{o.t}</span><span className="block text-[13px] text-muted-foreground">{o.s}</span>
                </label>)}
            </div>
          </fieldset>
          {d.saleMode === 'partial' && <Field label={tr('Minimum sale step', 'أقل مضاعف للبيع')} htmlFor="f-minimumIncrement" error={errors.minimumIncrement}
            hint={tr(`Buyers reserve in multiples of this amount. e.g. 5 means 5, 10, 15 ${unit || ''}.`, `يحجز المشتري بمضاعفات هذه الكمية. مثال: ٥ تعني ٥ أو ١٠ أو ١٥ ${unit || ''}.`)}>
            <input id="f-minimumIncrement" type="number" inputMode="decimal" min="0" step="any" value={d.minimumIncrement} onChange={(e) => set('minimumIncrement', e.target.value)} className="field num" {...err('minimumIncrement')} data-testid="input-minimum-increment" />
          </Field>}
        </div>}

        {step === 2 && <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr('Neighborhood in Riyadh', 'الحي في الرياض')} htmlFor="f-neighborhood" error={errors.neighborhood}>
              <input id="f-neighborhood" value={d.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder={tr('e.g. Al Malqa', 'مثال: الملقا')} className="field" dir="auto" {...err('neighborhood')} data-testid="input-neighborhood" />
            </Field>
            <Field label={tr('Map link', 'رابط الخريطة')} htmlFor="f-mapUrl" optional error={errors.mapUrl}>
              <input id="f-mapUrl" type="url" dir="ltr" value={d.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} placeholder="https://maps.google.com/..." className="field" {...err('mapUrl')} data-testid="input-map-url" />
            </Field>
          </div>
          <Field label={tr('Pickup details', 'تفاصيل الاستلام')} htmlFor="f-pickupDetails" error={errors.pickupDetails} hint={tr('Days and hours, loading help, gate or site access, vehicle size needed.', 'الأيام والساعات، المساعدة في التحميل، الدخول للموقع، حجم المركبة المطلوب.')}>
            <textarea id="f-pickupDetails" value={d.pickupDetails} onChange={(e) => set('pickupDetails', e.target.value)} className="field !min-h-[90px]" dir="auto" {...err('pickupDetails')} data-testid="input-pickup-details" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr('Phone number', 'رقم الهاتف')} htmlFor="f-phone" optional>
              <input id="f-phone" type="tel" dir="ltr" value={d.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+966 5x xxx xxxx" className="field" data-testid="input-listing-phone" />
            </Field>
            <label className={cx('flex min-h-[46px] cursor-pointer items-center gap-3 self-end rounded-xl border border-input px-4 text-sm font-semibold', !d.phone.trim() && 'opacity-50')}>
              <input type="checkbox" disabled={!d.phone.trim()} checked={d.phoneVisible && !!d.phone.trim()} onChange={(e) => set('phoneVisible', e.target.checked)} className="size-4 accent-[#075E54]" data-testid="checkbox-phone-visible" />
              {tr('Show my phone on the listing', 'أظهر رقمي في الإعلان')}
            </label>
          </div>
          <div className="border-t border-border pt-5">
            <h2 className="text-base font-semibold">{tr('Preview', 'معاينة')}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border"><ListingPhoto src={d.photos[0]} alt="" /></div>
              <dl className="space-y-1.5 text-sm">
                <dt className="sr-only">{tr('Title', 'العنوان')}</dt><dd className="text-base font-semibold">{preview.title}</dd>
                <dd><PriceTag listing={preview} /></dd>
                <dd className="text-muted-foreground num">{num(preview.quantity)} <bdi>{unit}</bdi> · {preview.saleMode === 'full_lot' ? tr('Full lot only', 'الكمية كاملة فقط') : tr(`Steps of ${num(Number(d.minimumIncrement) || 0)}`, `بمضاعفات ${num(Number(d.minimumIncrement) || 0)}`)} · {cond(d.condition)}</dd>
                <dd className="flex items-center gap-1 text-muted-foreground"><MapPin size={14} /><bdi>{d.neighborhood || '-'}</bdi></dd>
                <dd className="text-muted-foreground">{isAr ? preview.categoryNameAr : preview.categoryNameEn}{d.photos.length ? ` · ${num(d.photos.length)} ${tr('photos', 'صور')}` : ''}</dd>
              </dl>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">{tr('After publishing you can update the quantity, pickup details and map link. Other details cannot be changed.', 'بعد النشر يمكنك تحديث الكمية وتفاصيل الاستلام ورابط الخريطة فقط.')}</p>
          </div>
          {submitError && <p role="alert" className="rounded-xl bg-[#fdecea] p-3 text-sm font-medium text-destructive">{submitError}</p>}
        </div>}
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        {step > 0 ? <Button variant="outline" onClick={() => go(step - 1)} testId="button-step-back"><ArrowLeft size={16} className="rtl-flip" />{tr('Back', 'رجوع')}</Button> : <span />}
        {step < 2 ? <Button onClick={() => go(step + 1)} testId="button-step-next">{tr('Next', 'التالي')}<ArrowRight size={16} className="rtl-flip" /></Button>
          : user ? <Button type="submit" size="lg" disabled={create.isPending || uploading} testId="button-publish-listing">{create.isPending ? <><Spinner />{tr('Publishing…', 'جارٍ النشر…')}</> : <><Check size={17} />{tr('Publish listing', 'انشر الإعلان')}</>}</Button>
          : <Link href={signInHref(location)} className={btn('primary', 'lg')} data-testid="link-sign-in-to-publish">{tr('Sign in to publish', 'سجّل الدخول للنشر')}</Link>}
      </div>
    </form>
  </main>;
}

function EditListing({ id }: { id: string }) {
  const { tr } = useLang();
  const { user } = useMember();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const listing = useGetListing(id, { query: { enabled: !!id, queryKey: getGetListingQueryKey(id) }, request: REQ });
  const update = useUpdateListing({ request: REQ });
  const [quantity, setQuantity] = useState('');
  const [pickupDetails, setPickupDetails] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [errors, setErrors] = useState<{ quantity?: string; pickupDetails?: string; mapUrl?: string }>({});
  const init = useRef<string | null>(null);
  useEffect(() => {
    if (listing.data && init.current !== id) {
      init.current = id;
      setQuantity(String(listing.data.quantity)); setPickupDetails(listing.data.pickupDetails); setMapUrl(listing.data.mapUrl ?? '');
    }
  }, [listing.data, id]);
  if (listing.isLoading) return <main className="mx-auto max-w-2xl px-4 py-8"><SkeletonRows rows={3} /></main>;
  if (listing.isError || !listing.data) return <main className="px-4 py-10"><ErrorState retry={() => void listing.refetch()} /></main>;
  const current = listing.data;
  if (current.sellerId !== user?.id) return <main className="mx-auto max-w-2xl px-4 py-10">
    <BackLink href={`/listing/${id}`}>{tr('Back to listing', 'العودة للإعلان')}</BackLink>
    <ErrorState message={tr('Only the listing owner can update these details.', 'يمكن لصاحب الإعلان فقط تحديث هذه التفاصيل.')} />
  </main>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!Number.isFinite(Number(quantity)) || !(Number(quantity) >= 0) || quantity.trim() === '') er.quantity = tr('Enter zero or more.', 'أدخل صفراً أو أكثر.');
    else if (current.saleMode === 'partial' && Number(quantity) > 0 && Number(quantity) < current.minimumIncrement) er.quantity = tr(`Enter at least ${current.minimumIncrement}, or zero to remove the listing from browsing.`, `أدخل ${current.minimumIncrement} على الأقل، أو صفراً لإزالة الإعلان من التصفح.`);
    if (!pickupDetails.trim()) er.pickupDetails = tr('Pickup details are required.', 'تفاصيل الاستلام مطلوبة.');
    if (mapUrl.trim() && !/^https?:\/\//i.test(mapUrl.trim())) er.mapUrl = tr('Use a full link starting with https://', 'استخدم رابطاً كاملاً يبدأ بـ https://');
    setErrors(er);
    if (Object.keys(er).length || update.isPending) return;
    update.mutate({ id, data: { quantity: Number(quantity), pickupDetails: pickupDetails.trim(), mapUrl: mapUrl.trim() || null } }, {
      onSuccess: async () => { await qc.invalidateQueries({ queryKey: getGetListingQueryKey(id) }); await qc.invalidateQueries({ queryKey: getListListingsQueryKey() }); setLocation(`/listing/${id}`); },
    });
  };
  return <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
    <BackLink href={`/listing/${id}`}>{tr('Back to listing', 'العودة للإعلان')}</BackLink>
    <PageTitle title={tr('Update listing', 'تحديث الإعلان')} subtitle={listing.data.title} />
    <form onSubmit={submit} noValidate><Card className="space-y-5 p-5 sm:p-6">
      <p className="rounded-xl bg-muted p-3 text-[13px] leading-5 text-muted-foreground">{tr('You can update the available quantity, pickup details and map link. Other details are fixed once published.', 'يمكنك تحديث الكمية المتاحة وتفاصيل الاستلام ورابط الخريطة. التفاصيل الأخرى ثابتة بعد النشر.')}</p>
      <Field label={`${tr('Available quantity', 'الكمية المتاحة')} (${listing.data.unit})`} htmlFor="e-quantity" error={errors.quantity}>
        <input id="e-quantity" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="field num" aria-invalid={!!errors.quantity} data-testid="input-edit-quantity" />
      </Field>
      <Field label={tr('Pickup details', 'تفاصيل الاستلام')} htmlFor="e-pickup" error={errors.pickupDetails}>
        <textarea id="e-pickup" value={pickupDetails} onChange={(e) => setPickupDetails(e.target.value)} className="field !min-h-[90px]" dir="auto" aria-invalid={!!errors.pickupDetails} data-testid="input-edit-pickup" />
      </Field>
      <Field label={tr('Map link', 'رابط الخريطة')} htmlFor="e-map" optional error={errors.mapUrl}>
        <input id="e-map" type="url" dir="ltr" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} className="field" aria-invalid={!!errors.mapUrl} data-testid="input-edit-map" />
      </Field>
      {update.isError && <p role="alert" className="text-sm text-destructive">{tr('Could not save. Only the listing owner can update it.', 'تعذر الحفظ. يمكن لصاحب الإعلان فقط تحديثه.')}</p>}
      <Button type="submit" disabled={update.isPending} testId="button-save-listing">{update.isPending ? <Spinner /> : <Check size={16} />}{tr('Save changes', 'حفظ التغييرات')}</Button>
    </Card></form>
  </main>;
}
