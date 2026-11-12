import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useRequestUploadUrl, useSearchByImage } from '@workspace/api-client-react';
import type { ImageSearchInput, Listing } from '@workspace/api-client-react';
import { ImagePlus, LockKeyhole, Search, Trash2 } from 'lucide-react';
import { useLang } from './lang';
import { Button, ListingPhoto, Modal, Spinner, btn, useMember } from './ui';
import { REQ, signInHref } from '@/lib/baqi';

export const SEARCH_UNITS = ['piece', 'bag', 'box', 'sheet', 'roll', 'm', 'm²', 'm³', 'ton', 'kg', 'pallet'];
export type BaseFilters = Pick<ImageSearchInput, 'q' | 'categoryId' | 'condition' | 'freeOnly' | 'sort'>;
export type PhotoSearch = { objectPath: string; minQuantity?: number; unit?: string };

/** Owns transient image-search results outside the query cache; results are tagged by the exact request key. */
export function useImageSearch() {
  const m = useSearchByImage({ request: REQ });
  const [state, setState] = useState<{ key: string; data?: Listing[]; error?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const reqId = useRef(0);
  useEffect(() => () => { reqId.current++; }, []);
  const keyOf = (p: PhotoSearch, f: BaseFilters) => JSON.stringify([p.objectPath, p.minQuantity, p.unit, f.q, f.categoryId, f.condition, f.freeOnly, f.sort]);
  const run = (p: PhotoSearch, f: BaseFilters) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const id = ++reqId.current; const key = keyOf(p, f);
    setState({ key });
    m.mutateAsync({ data: { ...f, objectPath: p.objectPath, minQuantity: p.minQuantity, unit: p.minQuantity ? p.unit : undefined } })
      .then((data) => { if (id === reqId.current) setState({ key, data }); })
      .catch((error: { status?: number }) => { if (id === reqId.current) setState({ key, error: error.status ?? 503 }); })
      .finally(() => { if (id === reqId.current) { lock.current = false; setBusy(false); } });
  };
  const reset = () => { reqId.current++; lock.current = false; setBusy(false); setState(null); };
  return { state, busy, run, reset, keyOf };
}

export function PhotoSearchDialog({ open, onOpenChange, initial, onSearch }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial: PhotoSearch | null; onSearch: (p: PhotoSearch) => void;
}) {
  const { tr } = useLang();
  const { user, isLoaded } = useMember();
  const [location] = useLocation();
  const upload = useRequestUploadUrl({ request: REQ });
  const [path, setPath] = useState(initial?.objectPath ?? '');
  const [qty, setQty] = useState(initial?.minQuantity ? String(initial.minQuantity) : '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [customUnit, setCustomUnit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const upId = useRef(0);
  useEffect(() => { if (open) {
    const savedUnit = initial?.unit ?? '';
    setPath(initial?.objectPath ?? ''); setQty(initial?.minQuantity ? String(initial.minQuantity) : '');
    setUnit(savedUnit && !SEARCH_UNITS.includes(savedUnit) ? 'custom' : savedUnit);
    setCustomUnit(savedUnit && !SEARCH_UNITS.includes(savedUnit) ? savedUnit : ''); setErr('');
  } else { upId.current++; setUploading(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { upId.current++; }, []);

  const onFile = async (file?: File) => {
    setErr('');
    if (!file || uploading) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setErr(tr('Use a JPEG, PNG or WebP image up to 10 MB.', 'استخدم صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 10 ميغابايت.')); return; }
    const id = ++upId.current; setUploading(true);
    try {
      const signed = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' } });
      const put = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error(String(put.status));
      if (id === upId.current) setPath(signed.objectPath);
    } catch { if (id === upId.current) setErr(tr('The photo could not be uploaded. Try again.', 'تعذر رفع الصورة. حاول مرة أخرى.')); }
    finally { if (id === upId.current) setUploading(false); }
  };
  const q = Number(qty);
  const selectedUnit = unit === 'custom' ? customUnit.trim() : unit;
  const qtyErr = qty.trim() && (!Number.isFinite(q) || !(q > 0)) ? tr('Enter a quantity greater than zero.', 'أدخل كمية أكبر من صفر.') : qty.trim() && !selectedUnit ? tr('Choose the unit for this quantity.', 'اختر وحدة هذه الكمية.') : '';
  const submit = () => { if (!path || uploading || qtyErr) return; onSearch({ objectPath: path, minQuantity: qty.trim() ? q : undefined, unit: qty.trim() ? selectedUnit : undefined }); };
  const unitLabels: Record<string, string> = {
    piece: tr('piece', 'قطعة'), bag: tr('bag', 'كيس'), box: tr('box', 'كرتون'), sheet: tr('sheet', 'لوح'),
    roll: tr('roll', 'لفة'), ton: tr('ton', 'طن'), kg: tr('kg', 'كجم'), pallet: tr('pallet', 'منصة'),
  };

  return <Modal open={open} onOpenChange={onOpenChange} title={tr('Search with a photo', 'ابحث بصورة')} description={tr('Upload a photo of the material you need. We compare it with recent listings.', 'ارفع صورة للمادة التي تحتاجها. سنقارنها بالإعلانات الحديثة.')}>
    {isLoaded && !user ? <div className="text-center" data-testid="panel-photo-search-signin">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-secondary text-primary"><LockKeyhole size={20} /></div>
      <p className="font-semibold">{tr('Sign in to search by photo', 'سجّل الدخول للبحث بالصورة')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr('Photos are stored privately with your account. Text search and filters work without signing in.', 'تُحفظ الصور بشكل خاص مع حسابك. البحث النصي والتصفية يعملان بلا تسجيل.')}</p>
      <Link href={signInHref(location + window.location.search)} className={`${btn('primary')} mt-5`} data-testid="link-photo-search-sign-in">{tr('Sign in', 'تسجيل الدخول')}</Link>
    </div> : <div className="space-y-4">
      {path ? <div className="flex items-center gap-3 rounded-xl border border-border p-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg"><ListingPhoto src={path} alt={tr('Reference photo', 'الصورة المرجعية')} /></div>
        <div className="flex flex-1 flex-wrap gap-2">
          <label className={`${btn('outline', 'sm')} cursor-pointer`}>{uploading ? <Spinner /> : <ImagePlus size={14} />}{tr('Replace', 'استبدال')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => { void onFile(e.target.files?.[0]); e.currentTarget.value = ''; }} data-testid="input-replace-search-photo" /></label>
          <Button size="sm" variant="ghost" onClick={() => { upId.current++; setUploading(false); setPath(''); }} testId="button-clear-search-photo"><Trash2 size={14} />{tr('Remove', 'إزالة')}</Button>
        </div>
      </div> : <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
        {uploading ? <><Spinner />{tr('Uploading…', 'جارٍ الرفع…')}</> : <><ImagePlus size={24} />{tr('Choose a reference photo', 'اختر صورة مرجعية')}</>}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => { void onFile(e.target.files?.[0]); e.currentTarget.value = ''; }} data-testid="input-search-photo" />
      </label>}
      {err && <p role="alert" className="text-[13px] font-medium text-destructive">{err}</p>}
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1 text-sm font-semibold">{tr('Total quantity needed', 'الكمية الإجمالية المطلوبة')} <span className="text-xs font-normal text-muted-foreground">{tr('Optional', 'اختياري')}</span></legend>
        <input type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="field num" aria-label={tr('Quantity', 'الكمية')} aria-invalid={!!qtyErr} data-testid="input-search-min-quantity" />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="field" aria-label={tr('Unit', 'الوحدة')} data-testid="select-search-unit">
          <option value="">{tr('Unit', 'الوحدة')}</option>{SEARCH_UNITS.map((u) => <option key={u} value={u}>{unitLabels[u] ?? u}</option>)}
          <option value="custom">{tr('Custom unit', 'وحدة مخصصة')}</option>
        </select>
        {unit === 'custom' && <input className="field col-span-2" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} maxLength={40} placeholder={tr('Exact unit used in the listing', 'الوحدة كما وردت في الإعلان')} aria-label={tr('Custom unit', 'وحدة مخصصة')} data-testid="input-search-custom-unit" />}
      </fieldset>
      <p className="-mt-2 text-[13px] text-muted-foreground">{qtyErr ? <span className="font-medium text-destructive">{qtyErr}</span> : tr('Each result must have this much on its own, in exactly this unit. No conversion.', 'يجب أن تتوفر هذه الكمية في كل نتيجة وحدها، وبهذه الوحدة تماماً. بلا تحويل.')}</p>
      <p className="rounded-lg bg-muted p-3 text-[13px] leading-5 text-muted-foreground">{tr('Compares against up to 12 recent listings with photos that match your other filters. Similar looks do not prove size, model or grade.', 'تتم المقارنة مع ما يصل إلى ١٢ إعلاناً حديثاً بصور تطابق خياراتك الأخرى. التشابه في الشكل لا يثبت المقاس أو الطراز أو الدرجة.')}</p>
      <Button className="w-full" onClick={submit} disabled={!path || uploading || !!qtyErr} testId="button-run-photo-search"><Search size={16} />{tr('Search', 'بحث')}</Button>
    </div>}
  </Modal>;
}
