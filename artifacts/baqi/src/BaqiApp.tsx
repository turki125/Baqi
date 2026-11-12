import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import {
  useAskHelp, useConfirmOrderReceipt, useCreateConversation, useCreateListing, useCreateOrder,
  useGetListing, useGetWallet, useListCategories, useListConversations, useListListings,
  useListMessages, useListOrders, usePayOrderBalance, usePayOrderDeposit, useRequestUploadUrl,
  useRequestWithdrawal, useSearchByImage, useSendMessage, useUpdateListing, getGetListingQueryKey,
  getListListingsQueryKey, getListOrdersQueryKey,
  getListConversationsQueryKey, getListMessagesQueryKey, getGetWalletQueryKey,
} from '@workspace/api-client-react';
import type { Listing, ListingInput, Order, WalletTransaction } from '@workspace/api-client-react';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Box, Check,
  CircleHelp, Clock3, CreditCard, Hammer, ImagePlus, Languages, LockKeyhole,
  MapPin, Menu, MessageCircle, PackageCheck, Search, Send, ShieldCheck,
  Truck, Wallet as WalletIcon, X,
} from 'lucide-react';

type Lang = 'en' | 'ar';
const dictionary = {
  en: {
    discover: 'Discover', sell: 'Sell materials', messages: 'Messages', orders: 'Orders', wallet: 'Wallet',
    signIn: 'Sign in', near: 'Riyadh, Saudi Arabia', title: 'Good materials deserve', titleEm: 'another build.',
    intro: 'Find useful surplus from nearby sites. Pick up locally, pay securely, keep good stock in use.',
    search: 'What are you looking for?', explore: 'Browse materials', all: 'All materials', free: 'Free only',
    newest: 'Newest first', lowest: 'Lowest price', highest: 'Highest price', closest: 'Around Riyadh', verified: 'Trusted sellers',
    anyCondition: 'Any condition', newCondition: 'New', likeNewCondition: 'Like new', usedCondition: 'Used',
    how: 'A better way to build', step1: 'Find nearby surplus', step2: 'Agree on pickup', step3: 'Keep it in use',
    help: 'Ask Baqi', helpSub: 'Questions about deposits, pickup, or how Baqi works?', noListings: 'No materials match those filters.',
    retry: 'Try again', available: 'available', used: 'Used', likeNew: 'Like new', new: 'New',
    noPhoto: 'Material photo', quantity: 'Quantity', pickup: 'Pickup details', contact: 'Message seller',
    reserve: 'Reserve this material', quantityNeed: 'Quantity to reserve', reserveNow: 'Continue to deposit',
    deposit: '10% reservation deposit', demo: 'Demo payment simulation · no real charge',
    card: 'Card', mada: 'Mada', ask: 'Ask a question', send: 'Send message', location: 'Pickup in Riyadh',
    signRequired: 'Sign in to continue', createAccount: 'Create your Baqi account', back: 'Back to browse',
    signInTitle: 'Welcome back', signUpTitle: 'Join Baqi', authHelp: 'Your account keeps reservations, messages and wallet activity together.',
    protected: 'This area is for signed-in members.', goSignIn: 'Sign in to continue',
    loading: 'Loading your Baqi view…', error: 'We could not load this right now.', empty: 'Nothing here yet.',
    paymentDemo: 'Card and Mada payments are demo simulations. No real payment is taken.',
    withdrawalDemo: 'Wallet withdrawals are demo simulations. No bank transfer will be made.',
    viewListing: 'View material', support: 'If this needs a policy decision, we will refer you to support.',
    excessQuantity: 'The minimum sale increment changes your quantity to', acceptExcess: 'I agree to take the full quantity shown.',
    freePickup: 'Request free pickup', signOut: 'Sign out', photoSearchLater: 'Photo search will be available after Baqi AI is connected.',
    photoSuggestionLater: 'Photo suggestions are paused until Baqi AI is connected.',
  },
  ar: {
    discover: 'اكتشف', sell: 'بع المواد', messages: 'الرسائل', orders: 'الطلبات', wallet: 'المحفظة',
    signIn: 'تسجيل الدخول', near: 'الرياض، المملكة العربية السعودية', title: 'المواد الجيدة تستحق', titleEm: 'بناءً آخر.',
    intro: 'اعثر على فائض مفيد من مواقع قريبة. استلم محلياً وادفع بأمان وأبقِ المواد الجيدة قيد الاستخدام.',
    search: 'عن ماذا تبحث؟', explore: 'تصفح المواد', all: 'كل المواد', free: 'مجاني فقط',
    newest: 'الأحدث أولاً', lowest: 'الأقل سعراً', highest: 'الأعلى سعراً', closest: 'في الرياض', verified: 'بائعون موثوقون',
    anyCondition: 'كل الحالات', newCondition: 'جديد', likeNewCondition: 'شبه جديد', usedCondition: 'مستعمل',
    how: 'طريقة أفضل للبناء', step1: 'اعثر على فائض قريب', step2: 'اتفق على الاستلام', step3: 'أبقِه قيد الاستخدام',
    help: 'اسأل باقي', helpSub: 'لديك سؤال عن العربون أو الاستلام أو طريقة عمل باقي؟', noListings: 'لا توجد مواد تطابق هذه الخيارات.',
    retry: 'أعد المحاولة', available: 'متاح', used: 'مستعمل', likeNew: 'شبه جديد', new: 'جديد',
    noPhoto: 'صورة المادة', quantity: 'الكمية', pickup: 'تفاصيل الاستلام', contact: 'راسل البائع',
    reserve: 'احجز هذه المادة', quantityNeed: 'الكمية المطلوبة', reserveNow: 'تابع إلى العربون',
    deposit: 'عربون حجز ١٠٪', demo: 'محاكاة دفع تجريبية · لا يوجد خصم حقيقي',
    card: 'بطاقة', mada: 'مدى', ask: 'اطرح سؤالاً', send: 'أرسل الرسالة', location: 'الاستلام في الرياض',
    signRequired: 'سجّل الدخول للمتابعة', createAccount: 'أنشئ حساب باقي', back: 'العودة للتصفح',
    signInTitle: 'مرحباً بعودتك', signUpTitle: 'انضم إلى باقي', authHelp: 'يجمع حسابك الحجوزات والرسائل ونشاط المحفظة في مكان واحد.',
    protected: 'هذه الصفحة للأعضاء المسجلين.', goSignIn: 'سجّل الدخول للمتابعة',
    loading: 'جارٍ تحميل صفحة باقي…', error: 'تعذر التحميل الآن.', empty: 'لا يوجد شيء هنا بعد.',
    paymentDemo: 'مدفوعات البطاقة ومدى محاكاة تجريبية. لن يتم خصم أي مبلغ حقيقي.',
    withdrawalDemo: 'سحوبات المحفظة محاكاة تجريبية. لن يتم تحويل أي مبلغ إلى البنك.',
    viewListing: 'عرض المادة', support: 'إذا تطلب الأمر قراراً بشأن السياسات، سنحيلك إلى الدعم.',
    excessQuantity: 'يغيّر الحد الأدنى للبيع الكمية إلى', acceptExcess: 'أوافق على استلام الكمية الموضحة كاملة.',
    freePickup: 'اطلب استلاماً مجانياً', signOut: 'تسجيل الخروج', photoSearchLater: 'سيُتاح البحث بالصورة بعد ربط ذكاء باقي الاصطناعي.',
    photoSuggestionLater: 'اقتراحات الصور متوقفة حتى ربط ذكاء باقي الاصطناعي.',
  },
} as const;

type Copy = { [Key in keyof typeof dictionary.en]: string };

function useLanguage() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('baqi-language') as Lang) || 'en');
  const toggle = () => setLang((current) => {
    const next = current === 'en' ? 'ar' : 'en';
    localStorage.setItem('baqi-language', next);
    window.dispatchEvent(new CustomEvent('baqi-language-change', { detail: next }));
    return next;
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  return { lang, t: dictionary[lang], toggle };
}

function useMember() {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    firstName: user.firstName,
    primaryEmailAddress: { emailAddress: user.primaryEmailAddress?.emailAddress },
  };
}

function Button({ children, onClick, variant = 'primary', disabled, type = 'button', className = '', testId }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'plain' | 'outline' | 'soft' | 'dark';
  disabled?: boolean; type?: 'button' | 'submit'; className?: string; testId?: string;
}) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId}
    className={`focus-ring inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variant === 'primary' ? 'bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-md' : variant === 'outline' ? 'border border-border bg-card text-foreground hover:bg-secondary' : variant === 'soft' ? 'bg-secondary text-secondary-foreground hover:brightness-95' : variant === 'dark' ? 'bg-[#1e3931] text-[#f6f0e4] hover:brightness-110' : 'text-foreground hover:bg-secondary'} ${className}`}>
    {children}
  </button>;
}

function Header({ lang, t, toggle }: { lang: Lang; t: Copy; toggle: () => void }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const user = useMember();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: '/', text: t.discover, icon: <Search size={16} /> },
    { href: '/messages', text: t.messages, icon: <MessageCircle size={16} /> },
    { href: '/orders', text: t.orders, icon: <PackageCheck size={16} /> },
    { href: '/wallet', text: t.wallet, icon: <WalletIcon size={16} /> },
  ];
  return <header className="sticky top-0 z-40 border-b border-[#dfd7c9] bg-[#f8f4ea]/95 backdrop-blur-md">
    <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-10">
      <Link href="/" className="flex shrink-0 items-center gap-3 no-underline" data-testid="link-home">
        <div className="grid size-10 place-items-center rounded-xl bg-[#204a3d] text-[#f8f4ea]"><span className="display text-[21px] font-extrabold">ب</span></div>
        <div><div className="display text-[22px] font-extrabold leading-none tracking-[-.07em]">baqi<span className="text-[#d7855e]">.</span></div><div className="mt-1 text-[9px] font-semibold uppercase tracking-[.16em] text-muted-foreground">RIYADH MATERIALS</div></div>
      </Link>
      <nav className="hidden items-center gap-1 lg:flex">
        {nav.map((item) => <Link key={item.href} href={item.href} data-testid={`link-nav-${item.href.replace('/', '') || 'discover'}`}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold no-underline transition-colors ${location === item.href || (item.href !== '/' && location.startsWith(item.href)) ? 'bg-[#e8e1d4] text-[#204a3d]' : 'text-[#5a665d] hover:bg-[#efebe2]'}`}>
          {item.icon}{item.text}</Link>)}
      </nav>
      <div className="hidden items-center gap-2 sm:flex">
        <Button variant="plain" onClick={toggle} className="px-3 py-2" testId="button-language"><Languages size={16} />{lang === 'en' ? 'العربية' : 'English'}</Button>
        <Link href="/sell" className="inline-flex items-center gap-2 rounded-full bg-[#d7855e] px-5 py-3 text-sm font-bold text-white no-underline hover:bg-[#c9744d]" data-testid="link-sell"><Hammer size={16} />{t.sell}</Link>
        {user ? <><div className="grid size-10 place-items-center rounded-full bg-[#dbe5d8] text-sm font-bold text-[#204a3d]" title={user.fullName || user.primaryEmailAddress?.emailAddress} data-testid="status-signed-in">{(user.firstName || user.fullName || 'B').slice(0, 1)}</div><Button variant="plain" onClick={() => void signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })} className="px-3 py-2" testId="button-sign-out">{t.signOut}</Button></> :
          <Link href="/sign-in" className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#234b3e] no-underline hover:bg-[#e9e2d5]" data-testid="link-sign-in">{t.signIn}</Link>}
      </div>
      <div className="flex items-center gap-1 sm:hidden">
        <Button variant="plain" onClick={toggle} className="px-3 py-2" testId="button-language-mobile">{lang === 'en' ? 'ع' : 'EN'}</Button>
        <Button variant="plain" onClick={() => setMobileOpen(!mobileOpen)} className="px-3 py-2" testId="button-menu">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</Button>
      </div>
    </div>
    {mobileOpen && <div className="border-t border-border bg-[#f8f4ea] px-4 py-3 sm:hidden">
      <div className="grid grid-cols-2 gap-2">{nav.map((item) => <Link key={item.href} onClick={() => setMobileOpen(false)} href={item.href} className="flex items-center gap-2 rounded-xl bg-[#efeade] p-3 text-sm font-semibold text-foreground no-underline">{item.icon}{item.text}</Link>)}
        <Link href="/sell" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-[#d7855e] p-3 text-sm font-semibold text-white no-underline"><Hammer size={16} />{t.sell}</Link>
        {!user ? <Link href="/sign-in" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-[#efeade] p-3 text-sm font-semibold text-foreground no-underline">{t.signIn}</Link> : <button onClick={() => { setMobileOpen(false); void signOut({ redirectUrl: import.meta.env.BASE_URL || '/' }); }} className="flex items-center gap-2 rounded-xl bg-[#efeade] p-3 text-sm font-semibold text-foreground">{t.signOut}</button>}
      </div>
    </div>}
  </header>;
}

function PageFrame({ children, lang, t, toggle }: { children: ReactNode; lang: Lang; t: Copy; toggle: () => void }) {
  return <div className={`baqi-shell grain ${lang === 'ar' ? 'arabic' : ''}`}><Header lang={lang} t={t} toggle={toggle} />{children}</div>;
}

function Loading({ t }: { t: Copy }) {
  return <div className="mx-auto max-w-[1300px] px-5 py-10" aria-label={t.loading}><div className="mb-8 h-8 w-48 animate-pulse rounded bg-[#e7dfd1]" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map((i) => <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card p-3"><div className="mb-4 aspect-[1.45] animate-pulse rounded-xl bg-[#e8dfd1]" /><div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-[#e8dfd1]" /><div className="h-4 w-1/3 animate-pulse rounded bg-[#e8dfd1]" /></div>)}</div></div>;
}

function ErrorPanel({ t, retry }: { t: Copy; retry?: () => void }) {
  return <div className="mx-auto my-10 max-w-xl rounded-2xl border border-[#dfc8b8] bg-[#fbf4ed] px-7 py-8 text-center" data-testid="status-error"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[#f0dfd1] text-[#a05238]"><CircleHelp size={21} /></div><p className="mb-5 text-sm text-foreground">{t.error}</p>{retry && <Button variant="outline" onClick={retry} testId="button-retry">{t.retry}</Button>}</div>;
}

function EmptyState({ t, title = t.empty }: { t: Copy; title?: string }) {
  return <div className="rounded-2xl border border-dashed border-[#cfc5b4] bg-[#f4efe5] px-7 py-14 text-center" data-testid="status-empty"><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#e5e9dd] text-primary"><Box size={25} /></div><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{t.empty}</p></div>;
}

function ListingCard({ listing, lang, t }: { listing: Listing; lang: Lang; t: Copy }) {
  const title = listing.title;
  const photo = listing.photos?.[0];
  const price = listing.isFree ? (lang === 'ar' ? 'مجاناً' : 'Free') : `${listing.unitPrice ?? 0} SAR / ${listing.unit}`;
  const condition = listing.condition === 'new' ? t.new : listing.condition === 'like_new' ? t.likeNew : t.used;
  return <Link href={`/listing/${listing.id}`} className="group block overflow-hidden rounded-[20px] border border-[#e2d9c9] bg-[#fcfaf5] text-foreground no-underline shadow-[0_6px_20px_rgba(36,54,44,.035)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(36,54,44,.11)]" data-testid={`card-listing-${listing.id}`}>
    <div className="listing-photo relative aspect-[1.55] overflow-hidden">
      {photo ? <img src={photo.startsWith('/objects/') ? `/api/storage${photo}` : photo} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" /> :
        <div className="relative grid h-full place-items-center overflow-hidden bg-[#e5d7bf]"><div className="absolute -right-8 -top-10 size-48 rounded-full border-[28px] border-[#d2bd9c]/60" /><div className="absolute -bottom-10 -left-4 size-44 rounded-full border-[24px] border-[#c3ac88]/40" /><div className="relative text-center"><div className="mx-auto mb-2 grid size-14 place-items-center rounded-2xl bg-[#f4eddf]/75 text-[#4e6959]"><PackageCheck size={25} /></div><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#655a48]">{t.noPhoto}</span></div></div>}
      <div className="absolute left-3 top-3 flex gap-1.5"><span className="rounded-full bg-[#f9f4e8]/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#3f5447]">{condition}</span>{listing.isFree && <span className="rounded-full bg-[#d7855e] px-3 py-1.5 text-[10px] font-bold text-white">{lang === 'ar' ? 'مجاني' : 'FREE'}</span>}</div>
      <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-[#f8f4ea]/90 text-[#264b3e] shadow-sm"><ArrowUpRight size={17} /></span>
    </div>
    <div className="p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground"><span>{lang === 'ar' ? listing.categoryNameAr : listing.categoryNameEn}</span><span className="flex items-center gap-1"><MapPin size={12} />{listing.neighborhood}</span></div>
      <h3 className="mb-3 line-clamp-2 min-h-[2.9rem] text-[16px] font-bold leading-[1.45] tracking-[-.02em]">{title}</h3>
      <div className="flex items-end justify-between gap-2 border-t border-[#ebe5da] pt-3">
        <div><div className="text-[18px] font-extrabold tracking-[-.04em] text-[#214b3e]">{price}</div><div className="mt-1 text-[11px] text-muted-foreground">{listing.quantity} {listing.unit} {t.available}</div></div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5a675e]">{listing.sellerTrusted && <BadgeCheck size={15} className="text-[#527766]" />}{listing.sellerName}</div>
      </div>
    </div>
  </Link>;
}

function HelpAssistant({ lang, t }: { lang: Lang; t: Copy }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const ask = useAskHelp({ request: { credentials: 'include' } });
  return <div className="fixed bottom-5 end-5 z-40" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    {open && <div className="mb-3 w-[min(355px,calc(100vw-40px))] overflow-hidden rounded-2xl border border-[#d9cebc] bg-[#fbf8f0] shadow-[0_20px_60px_rgba(31,57,47,.2)]">
      <div className="flex items-center justify-between bg-[#204a3d] px-5 py-4 text-[#f8f4ea]"><div><p className="font-bold">{t.help}</p><p className="mt-1 text-xs text-[#d0dbd1]">{t.helpSub}</p></div><button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close assistant"><X size={17} /></button></div>
      <div className="min-h-24 p-4 text-sm leading-6">{ask.data ? <div className="rounded-xl bg-[#e9eee5] p-3 text-[#29493d]">{ask.data.answer}{ask.data.supportReferral && <p className="mt-2 border-t border-[#cfdbcd] pt-2 text-xs font-semibold">{t.support}</p>}</div> : <p className="text-muted-foreground">{t.helpSub}</p>}
        {ask.isError && <p className="mt-2 text-xs text-[#a44737]">{t.error} {t.support}</p>}</div>
      <form className="flex gap-2 border-t border-[#e5ddcf] p-3" onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask.mutate({ data: { question: question.trim(), language: lang } }); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t.ask} maxLength={2000} className="min-w-0 flex-1 rounded-full border border-border bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" data-testid="input-help-question" />
        <button type="submit" disabled={ask.isPending || !question.trim()} className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d7855e] text-white disabled:opacity-50" aria-label={t.send} data-testid="button-send-help">{ask.isPending ? <span className="size-4 animate-pulse rounded-full bg-white/70" /> : <Send size={16} />}</button>
      </form>
    </div>}
    <button onClick={() => setOpen(!open)} aria-label={t.help} data-testid="button-open-help" className="flex items-center gap-2 rounded-full bg-[#204a3d] px-5 py-4 text-sm font-bold text-[#f8f4ea] shadow-[0_8px_25px_rgba(30,65,53,.26)] transition-transform hover:-translate-y-1"><CircleHelp size={19} />{t.help}</button>
  </div>;
}

function Catalog({ lang, t }: { lang: Lang; t: Copy }) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [condition, setCondition] = useState<'' | 'new' | 'like_new' | 'used'>('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const params = useMemo(() => ({ q: query || undefined, category: selectedCategory || undefined, condition: condition || undefined, freeOnly: freeOnly || undefined, sort }), [query, selectedCategory, condition, freeOnly, sort]);
  const listings = useListListings(params, { request: { credentials: 'include' } });
  const categories = useListCategories({ request: { credentials: 'include' } });
  const photoUpload = useRequestUploadUrl({ request: { credentials: 'include' } });
  const imageSearch = useSearchByImage({ request: { credentials: 'include' } });
  const [photoResults, setPhotoResults] = useState<Listing[] | null>(null);
  const [photoError, setPhotoError] = useState('');
  const handlePhotoSearch = async (file?: File) => {
    setPhotoError('');
    setPhotoResults(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setPhotoError(lang === 'ar' ? 'اختر صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 10 ميغابايت.' : 'Choose a JPEG, PNG or WebP image up to 10 MB.');
      return;
    }
    try {
      const signed = await photoUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' } });
      const response = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error(`Object upload failed (${response.status})`);
      imageSearch.mutate({ data: { objectPath: signed.objectPath, q: query || undefined } }, { onSuccess: (result) => setPhotoResults(result) });
    } catch (error) {
      setPhotoError(error instanceof Error ? `${lang === 'ar' ? 'تعذر البحث بالصورة:' : 'Photo search failed:'} ${error.message}` : t.error);
    }
  };
  return <main>
    <section className="relative mx-auto max-w-[1380px] overflow-hidden px-4 pb-12 pt-8 sm:px-7 sm:pb-16 sm:pt-12 lg:px-10 lg:pt-[72px]">
      <div className="pointer-events-none absolute -right-16 top-8 size-[390px] rounded-full border-[1px] border-[#d9d0c0]/60 sm:right-[-38px] sm:size-[530px]"><div className="absolute inset-9 rounded-full border border-[#ded5c6]/70" /><div className="absolute inset-[76px] rounded-full border border-[#ded5c6]/70" /><div className="absolute inset-[116px] rounded-full border border-[#ded5c6]/70" /></div>
      <div className="relative grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="max-w-[820px]">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#66786b]"><span className="size-2 rounded-full bg-[#d7855e]" />{t.near}</div>
          <h1 className="display max-w-[780px] text-[clamp(48px,7vw,88px)] font-extrabold leading-[.99] text-[#203e34]">{t.title}<br /><span className="text-[#c87854]">{t.titleEm}</span></h1>
          <p className="mt-6 max-w-[510px] text-base leading-7 text-[#66746a] sm:text-[17px]">{t.intro}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#657269]">
            <span className="flex items-center gap-2 rounded-full border border-[#ddd4c5] bg-[#faf7ef] px-3 py-2"><ShieldCheck size={15} className="text-[#3f7058]" />{t.verified}</span>
            <span className="flex items-center gap-2 rounded-full border border-[#ddd4c5] bg-[#faf7ef] px-3 py-2"><MapPin size={15} className="text-[#c87854]" />{t.closest}</span>
          </div>
        </div>
        <div className="hidden justify-self-end lg:block">
          <div className="relative w-[275px] rotate-[2deg] rounded-[28px] border border-[#d4c6ad] bg-[#e9dfce] p-3 shadow-[0_22px_60px_rgba(43,55,44,.14)]">
            <div className="flex h-[230px] items-end overflow-hidden rounded-[19px] bg-[#d0b994] p-4">
              <div className="absolute right-8 top-8 size-32 rounded-full border-[18px] border-[#eee4d3]/50" />
              <div className="absolute right-[68px] top-[68px] size-20 rounded-full border-[11px] border-[#b79a70]/65" />
              <div className="relative w-full rounded-[15px] bg-[#f6f0e4]/90 p-4"><div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[#577061]"><MapPin size={11} /> RIYADH PICKUP</div><p className="display text-[22px] font-bold leading-tight text-[#284b3e]">Stock stays<br />in circulation.</p></div>
            </div>
            <div className="px-2 pb-1 pt-3 text-[10px] font-bold tracking-[.16em] text-[#655e50]">SURPLUS, PUT TO WORK AGAIN</div>
          </div>
        </div>
      </div>
      <div className="relative mt-9 flex flex-col gap-3 rounded-[22px] border border-[#dcd2c2] bg-[#fbf8f0] p-3 shadow-[0_10px_32px_rgba(41,57,45,.07)] sm:flex-row sm:items-center sm:p-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 sm:px-3">
          <Search size={21} className="shrink-0 text-[#587063]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} className="w-full bg-transparent py-2 text-[15px] font-medium outline-none placeholder:text-[#92968d]" data-testid="input-search-listings" />
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="min-w-[132px] flex-1 rounded-full border border-[#ddd5c8] bg-[#f7f2e8] px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary" data-testid="select-category">
            <option value="">{t.all}</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}
          </select>
          <select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className="min-w-[132px] flex-1 rounded-full border border-[#ddd5c8] bg-[#f7f2e8] px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary" data-testid="select-condition">
            <option value="">{t.anyCondition}</option><option value="new">{t.newCondition}</option><option value="like_new">{t.likeNewCondition}</option><option value="used">{t.usedCondition}</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-w-[140px] flex-1 rounded-full border border-[#ddd5c8] bg-[#f7f2e8] px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary" data-testid="select-sort">
            <option value="newest">{t.newest}</option><option value="price_low">{t.lowest}</option><option value="price_high">{t.highest}</option>
          </select>
          <button onClick={() => setFreeOnly(!freeOnly)} aria-pressed={freeOnly} className={`rounded-full px-4 py-3 text-xs font-bold transition-colors ${freeOnly ? 'bg-[#204a3d] text-white' : 'border border-[#ddd5c8] bg-[#f7f2e8] text-[#4b5c50]'}`} data-testid="button-free-filter">{t.free}</button>
          <label className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-[#ddd5c8] bg-[#f7f2e8] px-4 py-3 text-xs font-bold text-[#7c8178]" title={t.photoSearchLater}>
            <ImagePlus size={15} />{lang === 'ar' ? 'بحث بالصورة' : 'Search by photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled onChange={(e) => { void handlePhotoSearch(e.target.files?.[0]); e.currentTarget.value = ''; }} data-testid="input-search-photo" />
          </label>
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">{t.photoSearchLater}</p>
      </div>
    </section>
    <section className="mx-auto max-w-[1380px] px-4 pb-16 sm:px-7 lg:px-10">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.19em] text-[#c87854]">{t.explore}</p><h2 className="display text-3xl font-extrabold tracking-[-.055em] text-[#203e34] sm:text-4xl">{t.all}</h2></div>
         <p className="hidden pb-1 text-xs font-semibold text-muted-foreground sm:block" data-testid="text-listing-count">{listings.data?.length ?? '—'} {t.available}</p>
      </div>
      {(photoUpload.isPending || imageSearch.isPending) && <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#e4ddcf]"><div className="h-full w-1/2 animate-pulse rounded-full bg-[#d7855e]" /></div>}
      {photoError && <p className="mb-4 rounded-xl bg-[#faeee7] p-3 text-sm font-semibold text-[#a34f3b]" data-testid="status-photo-search-error">{photoError}</p>}
      {imageSearch.isError && <p className="mb-4 rounded-xl bg-[#faeee7] p-3 text-sm font-semibold text-[#a34f3b]" data-testid="status-photo-search-error">{t.error}</p>}
      {listings.isLoading && !photoResults ? <Loading t={t} /> : listings.isError && !photoResults ? <ErrorPanel t={t} retry={() => void listings.refetch()} /> :
        (photoResults ?? listings.data)?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{(photoResults ?? listings.data)?.map((listing) => <ListingCard key={listing.id} listing={listing} lang={lang} t={t} />)}</div> : <EmptyState t={t} title={t.noListings} />}
    </section>
    <section className="bg-[#e9e4d8]">
      <div className="mx-auto grid max-w-[1380px] gap-8 px-4 py-14 sm:px-7 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-20">
        <div><p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#b96c4d]">BAQI / CIRCULAR MATERIALS</p><h2 className="display max-w-md text-4xl font-extrabold leading-[1.08] tracking-[-.055em] text-[#203e34] sm:text-5xl">{t.how}</h2><p className="mt-4 max-w-sm text-sm leading-6 text-[#69746a]">{t.intro}</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[{ no: '01', title: t.step1, icon: <Search size={19} /> }, { no: '02', title: t.step2, icon: <Truck size={19} /> }, { no: '03', title: t.step3, icon: <PackageCheck size={19} /> }].map((step) => <div key={step.no} className="rounded-[18px] border border-[#d5cebf] bg-[#f7f3e9] p-5"><div className="mb-8 flex items-center justify-between text-[#527161]"><span className="grid size-10 place-items-center rounded-xl bg-[#e2e9df]">{step.icon}</span><span className="text-xs font-bold tracking-widest text-[#b9a992]">{step.no}</span></div><h3 className="text-[15px] font-bold leading-snug text-[#29483b]">{step.title}</h3></div>)}
        </div>
      </div>
    </section>
    <HelpAssistant lang={lang} t={t} />
  </main>;
}

function Protected({ children, t }: { children: ReactNode; t: Copy }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <Loading t={t} />;
  if (!user) return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-[#e3eadd] text-primary"><LockKeyhole size={27} /></div><h1 className="display text-3xl font-extrabold text-[#203e34]">{t.protected}</h1><p className="mt-3 text-sm text-muted-foreground">{t.authHelp}</p><Link href="/sign-in" className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground no-underline">{t.goSignIn}</Link></div>;
  return <>{children}</>;
}

function ListingDetail({ lang, t }: { lang: Lang; t: Copy }) {
  const { id = '' } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const member = useMember();
  const listing = useGetListing(id, { query: { queryKey: getGetListingQueryKey(id) }, request: { credentials: 'include' } });
  const [quantity, setQuantity] = useState(1);
  const [excessAccepted, setExcessAccepted] = useState(false);
  const [notice, setNotice] = useState('');
  const createOrder = useCreateOrder({ request: { credentials: 'include' } });
  const startConversation = useCreateConversation({ request: { credentials: 'include' } });
  const queryClient = useQueryClient();
  if (listing.isLoading) return <Loading t={t} />;
  if (listing.isError || !listing.data) return <ErrorPanel t={t} retry={() => void listing.refetch()} />;
  const item = listing.data;
  const requestedQuantity = item.saleMode === 'full_lot' ? item.quantity : quantity;
  const actualQuantity = item.saleMode === 'full_lot'
    ? item.quantity
    : Math.ceil((requestedQuantity - 1e-9) / item.minimumIncrement) * item.minimumIncrement;
  const hasExcess = actualQuantity > requestedQuantity + 1e-9;
  const exceedsStock = actualQuantity > item.quantity + 1e-9;
  const total = item.isFree ? 0 : Math.round((item.unitPrice ?? 0) * actualQuantity * 100) / 100;
  const deposit = item.isFree ? 0 : Math.min(total, Math.max(0.01, Math.round(total * .1 * 100) / 100));
  const photo = item.photos?.[0];
  const toSignIn = () => setLocation(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
  const reserve = () => {
    if (!member) return toSignIn();
    createOrder.mutate({ data: { listingId: item.id, quantity: requestedQuantity, excessAccepted: !hasExcess || excessAccepted } }, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      setNotice(item.isFree
        ? (lang === 'ar' ? 'تم طلب الاستلام المجاني. تابع تفاصيله من صفحة الطلبات.' : 'Free pickup requested. Follow the order in Orders.')
        : (lang === 'ar' ? 'تم إنشاء الحجز. أكمل دفع العربون من صفحة الطلبات.' : 'Reservation created. Continue to your deposit in Orders.'));
    },
  });
  };
  const messageSeller = () => {
    if (!member) return toSignIn();
    startConversation.mutate({ data: { listingId: item.id, initialMessage: lang === 'ar' ? `مرحباً، لدي سؤال عن ${item.title}` : `Hello, I have a question about ${item.title}` } }, {
    onSuccess: async (conversation) => { await queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }); setLocation(`/messages/${conversation.id}`); },
  });
  };
  return <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-7 sm:py-10">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#637167] no-underline hover:text-primary"><ArrowLeft size={16} />{t.back}</Link>
    <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
      <div>
        <div className="listing-photo relative aspect-[1.5] overflow-hidden rounded-[24px] border border-[#d9cfbd] bg-[#e5d7bf]">
          {photo ? <img src={photo.startsWith('/objects/') ? `/api/storage${photo}` : photo} alt={item.title} className="h-full w-full object-cover" /> : <div className="relative grid h-full place-items-center"><div className="absolute right-[15%] top-[12%] size-52 rounded-full border-[32px] border-[#c3ac88]/35" /><div className="relative rounded-[22px] bg-[#f7f1e5]/80 p-8 text-center"><PackageCheck className="mx-auto mb-3 text-[#456451]" size={35} /><p className="text-sm font-bold text-[#5e604f]">{t.noPhoto}</p></div></div>}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">{[item.condition === 'new' ? t.new : item.condition === 'like_new' ? t.likeNew : t.used, lang === 'ar' ? item.categoryNameAr : item.categoryNameEn, item.saleMode === 'partial' ? (lang === 'ar' ? 'بيع جزئي متاح' : 'Partial quantities available') : (lang === 'ar' ? 'الكمية كاملة' : 'Full lot')].map((label) => <span key={label} className="rounded-full bg-[#e9e5d8] px-3 py-1.5 text-xs font-semibold text-[#536257]">{label}</span>)}</div>
        <h1 className="display mt-5 text-3xl font-extrabold leading-tight tracking-[-.05em] text-[#203e34] sm:text-5xl">{item.title}</h1>
        <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium text-muted-foreground"><span className="flex items-center gap-1.5"><MapPin size={15} />{item.neighborhood}, Riyadh</span><span className="flex items-center gap-1.5"><Clock3 size={15} />{new Date(item.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA')}</span></div>
        <div className="mt-8 rounded-2xl border border-[#e2d9c9] bg-[#fbf8f0] p-5 sm:p-7"><h2 className="mb-3 text-lg font-bold">{lang === 'ar' ? 'عن المادة' : 'About this material'}</h2><p className="whitespace-pre-line text-sm leading-7 text-[#5d6b60]">{item.description}</p>
          <div className="mt-6 grid gap-4 border-t border-[#e7dfd2] pt-5 sm:grid-cols-2"><div><p className="text-xs font-semibold text-muted-foreground">{t.quantity}</p><p className="mt-1 font-bold">{item.quantity} {item.unit}</p></div><div><p className="text-xs font-semibold text-muted-foreground">{t.pickup}</p><p className="mt-1 font-semibold">{item.pickupDetails}</p>{item.mapUrl && <a className="mt-2 inline-block text-xs font-bold text-primary underline" target="_blank" rel="noreferrer" href={item.mapUrl}>{lang === 'ar' ? 'عرض الموقع' : 'Open pickup map'}</a>}</div></div>
        </div>
        <div className="mt-5 rounded-2xl border border-[#e2d9c9] bg-[#fbf8f0] p-5">
          <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-full bg-[#e4eade] text-sm font-extrabold text-[#315a46]">{item.sellerName.slice(0,1)}</div><div className="flex-1"><p className="font-bold">{item.sellerName}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{item.sellerTrusted && <><BadgeCheck size={14} className="text-primary" />{lang === 'ar' ? 'بائع موثوق' : 'Trusted Baqi seller'}</>}</p></div><Button variant="outline" onClick={messageSeller} disabled={startConversation.isPending} testId="button-message-seller"><MessageCircle size={16} />{t.contact}</Button></div>
          {startConversation.isError && <p className="mt-3 text-sm text-[#a34f3b]">{t.error}</p>}
          {item.phoneVisible && item.sellerPhone && <a href={`tel:${item.sellerPhone}`} className="mt-4 inline-block text-sm font-bold text-primary">{item.sellerPhone}</a>}
        </div>
      </div>
      <aside>
        <div className="sticky top-[92px] rounded-[22px] border border-[#ddd4c4] bg-[#fbf8f0] p-5 shadow-[0_12px_38px_rgba(34,58,46,.07)] sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#b86e4f]">{t.location}</p>
          <p className="display mt-2 text-3xl font-extrabold tracking-[-.06em] text-[#234a3c]">{item.isFree ? (lang === 'ar' ? 'مجاناً' : 'Free') : `${item.unitPrice ?? 0} SAR`}<span className="ml-1 text-sm font-semibold tracking-normal text-muted-foreground">{!item.isFree && `/ ${item.unit}`}</span></p>
          <p className="mt-2 text-sm text-muted-foreground">{item.quantity} {item.unit} {t.available}</p>
          <div className="my-5 h-px bg-[#e8e0d2]" />
          <label className="text-xs font-bold">{t.quantityNeed}</label>
          {item.saleMode === 'full_lot' ? <p className="mt-2 rounded-xl bg-[#f1ecdf] px-4 py-3 text-sm font-semibold">{actualQuantity} {item.unit} · {lang === 'ar' ? 'الكمية كاملة' : 'Full lot only'}</p> :
            <div className="mt-2 flex items-center gap-3"><button onClick={() => { setQuantity(Math.max(0.01, quantity - 1)); setExcessAccepted(false); }} className="grid size-10 place-items-center rounded-full border border-border" aria-label="Decrease quantity">−</button><input type="number" min="0.01" max={item.quantity} step="any" value={quantity} onChange={(e) => { setQuantity(Math.max(0.01, Math.min(item.quantity, Number(e.target.value) || 0.01))); setExcessAccepted(false); }} className="h-10 w-24 rounded-xl border border-border bg-[#fffdf8] text-center font-bold" data-testid="input-order-quantity" /><button onClick={() => { setQuantity(Math.min(item.quantity, quantity + 1)); setExcessAccepted(false); }} className="grid size-10 place-items-center rounded-full border border-border" aria-label="Increase quantity">+</button><span className="text-xs text-muted-foreground">{item.unit}</span></div>}
          {hasExcess && <label className="mt-3 flex items-start gap-2 rounded-xl border border-[#ddcfbd] bg-[#f7f2e8] p-3 text-xs leading-5 text-[#536257]"><input type="checkbox" checked={excessAccepted} onChange={(e) => setExcessAccepted(e.target.checked)} className="mt-1 accent-[#315b48]" data-testid="checkbox-accept-excess" /><span>{t.excessQuantity} <strong>{actualQuantity} {item.unit}</strong>. {t.acceptExcess}</span></label>}
          {exceedsStock && <p className="mt-3 text-xs font-semibold text-[#a34f3b]">{lang === 'ar' ? 'الكمية المتاحة لا تكفي للزيادة إلى أقرب حد بيع.' : 'Available stock is below the next sale increment.'}</p>}
          <div className="mt-5 space-y-2 rounded-xl bg-[#f1ecdf] p-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">{lang === 'ar' ? 'الكمية المحجوزة' : 'Reserved quantity'}</span><strong>{actualQuantity} {item.unit}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">{lang === 'ar' ? 'قيمة المواد' : 'Material total'}</span><strong>{total.toFixed(2)} SAR</strong></div>{!item.isFree && <div className="flex justify-between"><span className="text-muted-foreground">{t.deposit}</span><strong>{deposit.toFixed(2)} SAR</strong></div>}</div>
          {!item.isFree && <p className="mt-3 text-[11px] leading-5 text-[#73796e]">{t.paymentDemo}</p>}
          <Button className="mt-5 w-full" onClick={reserve} disabled={createOrder.isPending || exceedsStock || (hasExcess && !excessAccepted)} testId="button-reserve-listing">{createOrder.isPending ? '…' : item.isFree ? t.freePickup : t.reserveNow}<ArrowRight size={16} /></Button>
          {!item.isFree && <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">{lang === 'ar' ? 'ستختار مدى أو البطاقة كمحاكاة دفع من صفحة الطلبات.' : 'Choose Mada or card as a demo payment in Orders.'}</p>}
          {createOrder.isError && <p className="mt-3 text-xs text-[#a34f3b]" data-testid="status-order-error">{t.error} {t.support}</p>}
          {notice && <div className="mt-3 rounded-xl bg-[#e3ecdf] p-3 text-sm font-semibold text-[#2f6145]" data-testid="status-order-created"><Check size={15} className="mr-1 inline" />{notice}<Link href="/orders" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#315944] underline">{lang === 'ar' ? 'الانتقال إلى الطلبات' : 'Go to Orders'}<ArrowRight size={13} /></Link></div>}
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#68776b]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" />{lang === 'ar' ? 'يتم تأكيد الاستلام محلياً. تحدث مع البائع لترتيب وقت مناسب.' : 'Pickup is arranged locally. Message the seller to agree on a time.'}</p>
        </div>
      </aside>
    </div>
    <HelpAssistant lang={lang} t={t} />
  </main>;
}

function SellPage({ lang, t }: { lang: Lang; t: Copy }) {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit') || '';
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const existing = useGetListing(editId, { query: { enabled: !!editId, queryKey: getGetListingQueryKey(editId) }, request: { credentials: 'include' } });
  const categories = useListCategories({ request: { credentials: 'include' } });
  const create = useCreateListing({ request: { credentials: 'include' } });
  const update = useUpdateListing({ request: { credentials: 'include' } });
  const upload = useRequestUploadUrl({ request: { credentials: 'include' } });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState<'new' | 'like_new' | 'used'>('used');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [price, setPrice] = useState('');
  const [free, setFree] = useState(false);
  const [saleMode, setSaleMode] = useState<'partial' | 'full_lot'>('partial');
  const [minimumIncrement, setMinimumIncrement] = useState('1');
  const [phone, setPhone] = useState('');
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [neighborhood, setNeighborhood] = useState('');
  const [pickupDetails, setPickupDetails] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [formError, setFormError] = useState('');
  const initialized = useRef(false);
  useEffect(() => {
    if (existing.data && !initialized.current) {
      const item = existing.data;
      initialized.current = true;
      setTitle(item.title); setDescription(item.description); setCategoryId(item.categoryId); setCondition(item.condition);
      setQuantity(String(item.quantity)); setUnit(item.unit); setPrice(String(item.unitPrice ?? '')); setFree(item.isFree);
      setSaleMode(item.saleMode); setMinimumIncrement(String(item.minimumIncrement));
      setPhone(item.sellerPhone ?? ''); setPhoneVisible(item.phoneVisible);
      setNeighborhood(item.neighborhood); setPickupDetails(item.pickupDetails); setMapUrl(item.mapUrl ?? ''); setPhotos(item.photos || []);
    }
  }, [existing.data]);
  const onUpload = async (file?: File) => {
    setUploadError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadError(lang === 'ar' ? 'استخدم صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 10 ميغابايت.' : 'Choose a JPEG, PNG or WebP image up to 10 MB.');
      return;
    }
    try {
      const response = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' } });
      const put = await fetch(response.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error(`Object upload failed (${put.status})`);
      setPhotos((current) => [...current, response.objectPath]);
    } catch (error) {
      setUploadError(error instanceof Error ? `${lang === 'ar' ? 'تعذر رفع الصورة:' : 'Photo upload failed:'} ${error.message}` : (lang === 'ar' ? 'تعذر رفع الصورة. حاول مرة أخرى.' : 'Photo upload failed. Please try again.'));
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    if (!title.trim() || !description.trim() || !categoryId || !neighborhood.trim() || !pickupDetails.trim() || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || (!free && (price.trim() === '' || !Number.isFinite(Number(price)) || Number(price) < 0)) || (saleMode === 'partial' && (!Number.isFinite(Number(minimumIncrement)) || Number(minimumIncrement) <= 0))) {
      setFormError(lang === 'ar' ? 'يرجى إكمال الحقول المطلوبة.' : 'Please complete all required fields.');
      return;
    }
    const body: ListingInput = {
      title: title.trim(), description: description.trim(), categoryId, condition, quantity: Number(quantity), unit,
      unitPrice: free ? null : Number(price), isFree: free, neighborhood: neighborhood.trim(), pickupDetails: pickupDetails.trim(),
      mapUrl: mapUrl.trim() || null, photos, phone: phone.trim() || null, phoneVisible: phoneVisible && !!phone.trim(),
      saleMode, minimumIncrement: saleMode === 'full_lot' ? Number(quantity) : Number(minimumIncrement),
    };
    if (editId) update.mutate({ id: editId, data: { quantity: Number(quantity), pickupDetails: pickupDetails.trim(), mapUrl: mapUrl.trim() || null } }, { onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(editId) }); setLocation(`/listing/${editId}`); } });
    else create.mutate({ data: body }, { onSuccess: async (created) => { await queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() }); setLocation(`/listing/${created.id}`); } });
  };
  const busy = create.isPending || update.isPending;
  return <Protected t={t}><main className="mx-auto max-w-4xl px-4 py-9 sm:px-7">
    <div className="mb-8"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#b96c4d]">BAQI / SELL</p><h1 className="display text-4xl font-extrabold tracking-[-.05em] text-[#203e34]">{editId ? (lang === 'ar' ? 'تعديل إعلانك' : 'Edit your listing') : (lang === 'ar' ? 'حوّل الفائض إلى قيمة' : 'Turn surplus into value')}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{lang === 'ar' ? 'أضف تفاصيل واضحة ليسهل على الناس القريبين الاستفادة من المواد.' : 'Add clear details so nearby builders can put your leftover materials to work.'}</p></div>
    {editId && existing.isLoading ? <Loading t={t} /> : <form onSubmit={submit} className="rounded-[22px] border border-[#ded5c5] bg-[#fbf8f0] p-5 sm:p-8">
      {editId && <p className="mb-6 rounded-xl bg-[#e9eee5] p-4 text-sm leading-6 text-[#405e4a]">{lang === 'ar' ? 'يمكنك تعديل الكمية وتعليمات الاستلام ورابط الموقع. بقية تفاصيل الإعلان الأصلية للعرض فقط.' : 'This listing editor supports quantity, pickup instructions and map link updates. Other original details remain read-only.'}</p>}
      <div className="mb-7 grid gap-5 sm:grid-cols-2">
        <Field label={lang === 'ar' ? 'عنوان الإعلان' : 'Listing title'}><input required disabled={!!editId} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'ar' ? 'مثال: بلاط بورسلان إضافي' : 'e.g. Extra porcelain floor tiles'} className="field-input disabled:opacity-60" data-testid="input-listing-title" /></Field>
        <Field label={lang === 'ar' ? 'الفئة' : 'Category'}><select required disabled={!!editId} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-input disabled:opacity-60" data-testid="select-listing-category"><option value="">—</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select></Field>
        <Field label={lang === 'ar' ? 'الكمية' : 'Quantity'}><div className="flex gap-2"><input required min="1" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="field-input" data-testid="input-listing-quantity" /><input required disabled={!!editId} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" className="field-input max-w-[140px] disabled:opacity-60" data-testid="input-listing-unit" /></div></Field>
        <Field label={lang === 'ar' ? 'الحالة' : 'Condition'}><select disabled={!!editId} value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className="field-input disabled:opacity-60" data-testid="select-listing-condition"><option value="new">{t.new}</option><option value="like_new">{t.likeNew}</option><option value="used">{t.used}</option></select></Field>
        <Field label={lang === 'ar' ? 'طريقة البيع' : 'Sale type'}><select disabled={!!editId} value={saleMode} onChange={(e) => setSaleMode(e.target.value as typeof saleMode)} className="field-input disabled:opacity-60" data-testid="select-sale-mode"><option value="partial">{lang === 'ar' ? 'بيع جزئي' : 'Partial quantities'}</option><option value="full_lot">{lang === 'ar' ? 'الكمية كاملة فقط' : 'Full lot only'}</option></select></Field>
        {saleMode === 'partial' && <Field label={lang === 'ar' ? 'أقل زيادة للبيع' : 'Minimum sale increment'}><input required disabled={!!editId} min=".001" step="any" type="number" value={minimumIncrement} onChange={(e) => setMinimumIncrement(e.target.value)} className="field-input disabled:opacity-60" data-testid="input-minimum-increment" /></Field>}
        <Field label={lang === 'ar' ? 'سعر الوحدة (ر.س)' : 'Unit price (SAR)'}><input min="0" type="number" step=".01" disabled={free || !!editId} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="field-input disabled:opacity-50" data-testid="input-listing-price" /></Field>
        <label className={`flex cursor-pointer items-center gap-3 self-end rounded-xl border border-[#ded5c5] bg-[#f5f0e6] px-4 py-3.5 text-sm font-semibold ${editId ? 'opacity-60' : ''}`}><input type="checkbox" disabled={!!editId} checked={free} onChange={(e) => setFree(e.target.checked)} className="size-4 accent-[#315b48]" data-testid="checkbox-listing-free" />{lang === 'ar' ? 'أعرضها مجاناً' : 'Offer this for free'}</label>
        <Field label={lang === 'ar' ? 'الحي' : 'Neighborhood'}><input required disabled={!!editId} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Al Malqa" className="field-input disabled:opacity-60" data-testid="input-neighborhood" /></Field>
        <Field label={lang === 'ar' ? 'تفاصيل الاستلام' : 'Pickup details'}><input required value={pickupDetails} onChange={(e) => setPickupDetails(e.target.value)} placeholder={lang === 'ar' ? 'ساعات الاستلام والتعليمات' : 'Pickup hours and instructions'} className="field-input" data-testid="input-pickup-details" /></Field>
        <div className="sm:col-span-2"><Field label={lang === 'ar' ? 'وصف المادة' : 'Material description'}><textarea required disabled={!!editId} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={lang === 'ar' ? 'اذكر المقاس واللون والكمية المتبقية وأي ملاحظات مهمة.' : 'Include dimensions, color, remaining quantity and anything buyers should know.'} className="field-input resize-y disabled:opacity-60" data-testid="input-listing-description" /></Field></div>
        <Field label={lang === 'ar' ? 'رابط الموقع (اختياري)' : 'Map link (optional)'}><input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.google.com/…" className="field-input" data-testid="input-map-url" /></Field>
        <Field label={lang === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone number (optional)'}><input type="tel" disabled={!!editId} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966…" className="field-input disabled:opacity-60" data-testid="input-listing-phone" /></Field>
        <label className={`flex cursor-pointer items-center gap-3 self-end rounded-xl border border-[#ded5c5] bg-[#f5f0e6] px-4 py-3.5 text-sm font-semibold ${editId ? 'opacity-60' : ''}`}><input type="checkbox" disabled={!!editId || !phone.trim()} checked={phoneVisible} onChange={(e) => setPhoneVisible(e.target.checked)} className="size-4 accent-[#315b48]" data-testid="checkbox-phone-visible" />{lang === 'ar' ? 'إظهار الرقم للمشترين' : 'Show phone to buyers'}</label>
      </div>
      <div className="mb-6 rounded-2xl border border-dashed border-[#cfc5b4] bg-[#f5f0e6] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-bold"><ImagePlus size={17} className="text-primary" />{lang === 'ar' ? 'صور المادة' : 'Material photos'}</p><p className="mt-1 text-xs text-muted-foreground">{lang === 'ar' ? 'JPEG أو PNG أو WebP، حتى 10 ميغابايت لكل صورة.' : 'JPEG, PNG or WebP, up to 10 MB per photo.'}</p></div>{!editId && <label className="cursor-pointer rounded-full border border-border bg-[#fbf8f0] px-4 py-2.5 text-xs font-bold hover:bg-secondary">{upload.isPending ? (lang === 'ar' ? 'جارٍ الرفع…' : 'Uploading…') : (lang === 'ar' ? 'اختر صورة' : 'Choose photo')}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending} onChange={(e) => { void onUpload(e.target.files?.[0]); e.currentTarget.value = ''; }} data-testid="input-listing-photo" /></label>}</div>
        {!!photos.length && <div className="mt-4 flex flex-wrap gap-3">{photos.map((photo, index) => <div key={`${photo}-${index}`} className="relative"><img src={photo.startsWith('/objects/') ? `/api/storage${photo}` : photo} alt={`Listing photo ${index + 1}`} className="size-20 rounded-xl object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#a34f3b] text-white" aria-label="Remove photo"><X size={13} /></button></div>)}</div>}
        {editId && photos.some((photo) => photo.startsWith('/objects/')) && <p className="mt-4 text-xs text-muted-foreground">{t.photoSuggestionLater}</p>}
        {uploadError && <p className="mt-3 text-sm font-semibold text-[#a34f3b]" data-testid="status-upload-error">{uploadError}</p>}
      </div>
      {formError && <p className="mb-4 text-sm font-semibold text-[#a34f3b]" data-testid="status-form-error">{formError}</p>}
      {(create.isError || update.isError) && <p className="mb-4 text-sm font-semibold text-[#a34f3b]" data-testid="status-save-error">{t.error} {lang === 'ar' ? 'تحقق من الاتصال وحاول مرة أخرى.' : 'Check your connection and try again.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm font-semibold text-muted-foreground no-underline">{t.back}</Link><Button type="submit" disabled={busy || upload.isPending} testId="button-publish-listing">{busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : editId ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save changes') : (lang === 'ar' ? 'نشر الإعلان' : 'Publish listing')}<ArrowRight size={16} /></Button></div>
    </form>}
  </main></Protected>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2 text-xs font-bold text-[#526357]">{label}{children}</label>;
}

function MessagesPage({ lang, t }: { lang: Lang; t: Copy }) {
  const conversations = useListConversations({ request: { credentials: 'include' } });
  return <Protected t={t}><main className="mx-auto max-w-5xl px-4 py-9 sm:px-7"><PageHeading kicker="BAQI / INBOX" title={t.messages} subtitle={lang === 'ar' ? 'تنسيق الاستلام وتفاصيل المواد مباشرة مع البائعين.' : 'Coordinate pickup and material details with sellers directly.'} />
    {conversations.isLoading ? <Loading t={t} /> : conversations.isError ? <ErrorPanel t={t} retry={() => void conversations.refetch()} /> : !conversations.data?.length ? <EmptyState t={t} /> :
      <div className="overflow-hidden rounded-[20px] border border-[#ded5c5] bg-[#fbf8f0]">{conversations.data.map((conversation) => <Link key={conversation.id} href={`/messages/${conversation.id}`} data-testid={`row-conversation-${conversation.id}`} className="flex items-center gap-4 border-b border-[#ebe5da] p-4 text-foreground no-underline last:border-b-0 hover:bg-[#f4efe5] sm:p-5"><div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e2e9df] text-lg font-bold text-[#315a46]">{conversation.participantName.slice(0,1)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{conversation.participantName}</p><time className="text-[11px] text-muted-foreground">{new Date(conversation.updatedAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA')}</time></div><p className="mt-1 truncate text-sm font-semibold text-[#50685a]">{conversation.listingTitle}</p><p className="mt-1 truncate text-xs text-muted-foreground">{conversation.lastMessage}</p></div><ArrowRight size={17} className="shrink-0 text-[#78907e]" /></Link>)}</div>}
  </main></Protected>;
}

function ChatPage({ lang, t }: { lang: Lang; t: Copy }) {
  const { id = '' } = useParams<{ id: string }>();
  const user = useMember();
  const messages = useListMessages(id, { query: { enabled: !!id, queryKey: getListMessagesQueryKey(id) }, request: { credentials: 'include' } });
  const send = useSendMessage({ request: { credentials: 'include' } });
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.data?.length]);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!content.trim()) return; const text = content.trim(); send.mutate({ id, data: { content: text } }, { onSuccess: async () => { setContent(''); await Promise.all([queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id) }), queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() })]); } }); };
  return <Protected t={t}><main className="mx-auto max-w-4xl px-4 py-8 sm:px-7"><Link href="/messages" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground no-underline"><ArrowLeft size={16} />{t.messages}</Link>
    <div className="flex min-h-[70dvh] flex-col overflow-hidden rounded-[22px] border border-[#ded5c5] bg-[#fbf8f0]"><div className="border-b border-[#e6dfd3] px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#b96c4d]">{lang === 'ar' ? 'محادثة الإعلان' : 'LISTING CONVERSATION'}</p><h1 className="mt-1 text-lg font-bold">{messages.data?.[0]?.senderName || t.messages}</h1></div>
       <div className="flex-1 space-y-3 overflow-y-auto bg-[#f5f0e6] px-4 py-5 sm:px-6">{messages.isLoading ? <Loading t={t} /> : messages.isError ? <ErrorPanel t={t} retry={() => void messages.refetch()} /> : !messages.data?.length ? <EmptyState t={t} /> : messages.data.map((msg) => <div key={msg.id} data-testid={`message-${msg.id}`} className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.senderId === user?.id ? 'ml-auto rounded-br-md bg-[#315a47] text-white' : 'rounded-bl-md border border-[#e1d8c9] bg-[#fbf8f0]'}`}><p className="mb-1 text-[10px] font-bold opacity-70">{msg.senderName}</p><p className="whitespace-pre-wrap text-sm leading-6">{msg.content}</p><time className="mt-2 block text-right text-[9px] opacity-60">{new Date(msg.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-SA', { hour: 'numeric', minute: '2-digit' })}</time></div>)}<div ref={bottomRef} /></div>
      <form onSubmit={submit} className="flex gap-2 border-t border-[#e6dfd3] p-3 sm:p-4"><input value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} placeholder={t.send} className="min-w-0 flex-1 rounded-full border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" data-testid="input-message" /><Button type="submit" disabled={!content.trim() || send.isPending} testId="button-send-message"><Send size={16} />{t.send}</Button></form>
      {send.isError && <p className="px-5 pb-3 text-sm text-[#a34f3b]">{t.error}</p>}
    </div>
  </main></Protected>;
}

function OrdersPage({ lang, t }: { lang: Lang; t: Copy }) {
  const orders = useListOrders({ request: { credentials: 'include' } });
  const payDeposit = usePayOrderDeposit({ request: { credentials: 'include' } });
  const confirm = useConfirmOrderReceipt({ request: { credentials: 'include' } });
  const payBalance = usePayOrderBalance({ request: { credentials: 'include' } });
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<'card' | 'mada'>('mada');
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  const statusLabel = (status: Order['status']) => ({
    pending_deposit: lang === 'ar' ? 'بانتظار العربون' : 'Deposit due',
    awaiting_pickup: lang === 'ar' ? 'جاهز للاستلام' : 'Awaiting pickup',
    balance_due: lang === 'ar' ? 'الرصيد مستحق' : 'Balance due',
    completed: lang === 'ar' ? 'مكتمل' : 'Completed',
    free_pickup: lang === 'ar' ? 'استلام مجاني' : 'Free pickup',
  })[status];
  const busyId = payDeposit.variables?.id || payBalance.variables?.id || confirm.variables?.id;
  return <Protected t={t}><main className="mx-auto max-w-5xl px-4 py-9 sm:px-7"><PageHeading kicker="BAQI / RESERVATIONS" title={t.orders} subtitle={lang === 'ar' ? 'تابع العربون والاستلام والرصيد المتبقي.' : 'Track your deposit, pickup and remaining balance.'} />
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#d8cbb8] bg-[#f1ebdc] p-4 text-xs leading-5 text-[#5e695e]"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" /><div><strong className="block text-[#315340]">{lang === 'ar' ? 'محاكاة الدفع' : 'Payment simulation'}</strong>{t.paymentDemo}</div></div>
    {orders.isLoading ? <Loading t={t} /> : orders.isError ? <ErrorPanel t={t} retry={() => void orders.refetch()} /> : !orders.data?.length ? <EmptyState t={t} /> :
      <div className="space-y-4">{orders.data.map((order) => <article key={order.id} className="rounded-[20px] border border-[#ded5c5] bg-[#fbf8f0] p-5 sm:p-6" data-testid={`card-order-${order.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/listing/${order.listingId}`} className="text-lg font-bold text-[#204a3d] no-underline hover:underline">{order.listingTitle}</Link><p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA')} · {order.quantity} {order.unit}</p></div><span className="rounded-full bg-[#e3eadd] px-3 py-1.5 text-xs font-bold text-[#315944]" data-testid={`status-order-${order.id}`}>{statusLabel(order.status)}</span></div>
        <div className="mt-5 grid gap-3 rounded-xl bg-[#f1ecdf] p-4 sm:grid-cols-3"><MoneyLine label={lang === 'ar' ? 'الإجمالي' : 'Total'} value={order.total} /><MoneyLine label={lang === 'ar' ? 'العربون (10٪)' : 'Deposit (10%)'} value={order.depositDue} /><MoneyLine label={lang === 'ar' ? 'الرصيد' : 'Balance'} value={order.balanceDue} /></div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {order.status === 'pending_deposit' && <><button onClick={() => setMethod('mada')} className={`rounded-full border px-3 py-2 text-xs font-bold ${method === 'mada' ? 'border-primary bg-[#e4eadf] text-primary' : 'border-border'}`}><CreditCard size={13} className="mr-1 inline" />{t.mada}</button><button onClick={() => setMethod('card')} className={`rounded-full border px-3 py-2 text-xs font-bold ${method === 'card' ? 'border-primary bg-[#e4eadf] text-primary' : 'border-border'}`}><CreditCard size={13} className="mr-1 inline" />{t.card}</button><Button onClick={() => payDeposit.mutate({ id: order.id, data: { method, simulateFailure: false } }, { onSuccess: refresh })} disabled={busyId === order.id} testId={`button-pay-deposit-${order.id}`}>{lang === 'ar' ? `ادفع العربون ${order.depositDue} ر.س` : `Simulate deposit · ${order.depositDue} SAR`}</Button></>}
          {order.status === 'awaiting_pickup' && <Button variant="outline" onClick={() => confirm.mutate({ id: order.id }, { onSuccess: refresh })} disabled={busyId === order.id} testId={`button-confirm-pickup-${order.id}`}><Check size={15} />{lang === 'ar' ? 'تأكيد الاستلام' : 'Confirm pickup'}</Button>}
          {order.status === 'balance_due' && <><span className="mr-1 text-xs text-muted-foreground">{lang === 'ar' ? 'طريقة الدفع:' : 'Pay with:'}</span><button onClick={() => setMethod('mada')} className={`rounded-full border px-3 py-2 text-xs font-bold ${method === 'mada' ? 'border-primary bg-[#e4eadf] text-primary' : 'border-border'}`}>{t.mada}</button><button onClick={() => setMethod('card')} className={`rounded-full border px-3 py-2 text-xs font-bold ${method === 'card' ? 'border-primary bg-[#e4eadf] text-primary' : 'border-border'}`}>{t.card}</button><Button onClick={() => payBalance.mutate({ id: order.id, data: { method, simulateFailure: false } }, { onSuccess: refresh })} disabled={busyId === order.id} testId={`button-pay-balance-${order.id}`}>{lang === 'ar' ? `ادفع الرصيد ${order.balanceDue} ر.س` : `Simulate balance · ${order.balanceDue} SAR`}</Button></>}
        </div>
        {(payDeposit.isError && payDeposit.variables?.id === order.id || confirm.isError && confirm.variables?.id === order.id || payBalance.isError && payBalance.variables?.id === order.id) && <p className="mt-3 text-xs font-semibold text-[#a34f3b]" data-testid={`status-payment-error-${order.id}`}>{t.error} {t.support}</p>}
        <p className="mt-3 text-[10px] text-muted-foreground">{lang === 'ar' ? 'تأكد من تفاصيل الاستلام مع البائع عبر الرسائل.' : 'Confirm pickup details with the seller in Messages.'}</p>
      </article>)}</div>}
    <HelpAssistant lang={lang} t={t} />
  </main></Protected>;
}

function MoneyLine({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value.toFixed(2)} SAR</p></div>;
}

function WalletPage({ lang, t }: { lang: Lang; t: Copy }) {
  const wallet = useGetWallet({ request: { credentials: 'include' } });
  const withdrawal = useRequestWithdrawal({ request: { credentials: 'include' } });
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState<'bank' | 'wallet'>('bank');
  const [feedback, setFeedback] = useState('');
  const transactions = wallet.data?.transactions ?? [];
  const submit = (e: FormEvent) => { e.preventDefault(); setFeedback(''); const value = Number(amount); if (!(value > 0) || value > (wallet.data?.available ?? 0)) return;
    withdrawal.mutate({ data: { amount: value, destination } }, { onSuccess: async () => { setFeedback(lang === 'ar' ? 'تم تسجيل طلب السحب التجريبي.' : 'Demo withdrawal request recorded.'); setAmount(''); await queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() }); } }); };
  return <Protected t={t}><main className="mx-auto max-w-5xl px-4 py-9 sm:px-7"><PageHeading kicker="BAQI / SELLER WALLET" title={t.wallet} subtitle={lang === 'ar' ? 'رصيدك من المبيعات وسجل المعاملات.' : 'Your sale proceeds and transaction history.'} />
    {wallet.isLoading ? <Loading t={t} /> : wallet.isError || !wallet.data ? <ErrorPanel t={t} retry={() => void wallet.refetch()} /> : <>
      <div className="grid gap-3 sm:grid-cols-3"><BalanceCard label={lang === 'ar' ? 'متاح للسحب' : 'Available to withdraw'} value={wallet.data.available} tone="dark" /><BalanceCard label={lang === 'ar' ? 'قيد الانتظار' : 'Pending'} value={wallet.data.pending} /><BalanceCard label={lang === 'ar' ? 'إجمالي مكتمل' : 'Completed'} value={wallet.data.completed} /></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <form onSubmit={submit} className="rounded-[20px] border border-[#ded5c5] bg-[#fbf8f0] p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#e5eadd] text-primary"><Banknote size={19} /></div><div><h2 className="font-bold">{lang === 'ar' ? 'طلب سحب' : 'Request a withdrawal'}</h2><p className="mt-1 text-xs text-muted-foreground">{t.withdrawalDemo}</p></div></div>
          <Field label={lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)'}><input required type="number" min=".01" max={wallet.data.available} step=".01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" data-testid="input-withdrawal-amount" /></Field>
          <Field label={lang === 'ar' ? 'الوجهة' : 'Destination'}><select value={destination} onChange={(e) => setDestination(e.target.value as typeof destination)} className="field-input" data-testid="select-withdrawal-destination"><option value="bank">{lang === 'ar' ? 'حساب بنكي (تجريبي)' : 'Bank account (demo)'}</option><option value="wallet">{lang === 'ar' ? 'المحفظة (تجريبي)' : 'Wallet (demo)'}</option></select></Field>
          <Button type="submit" className="mt-5 w-full" disabled={withdrawal.isPending || !amount || Number(amount) > wallet.data.available} testId="button-request-withdrawal">{withdrawal.isPending ? '…' : (lang === 'ar' ? 'إرسال طلب تجريبي' : 'Submit demo request')}<ArrowUpRight size={16} /></Button>
          {feedback && <p className="mt-3 rounded-xl bg-[#e3ecdf] p-3 text-sm font-semibold text-[#315944]" data-testid="status-withdrawal-success">{feedback}</p>}
          {withdrawal.isError && <p className="mt-3 text-sm text-[#a34f3b]" data-testid="status-withdrawal-error">{t.error} {t.support}</p>}
        </form>
        <section className="rounded-[20px] border border-[#ded5c5] bg-[#fbf8f0] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold">{lang === 'ar' ? 'آخر المعاملات' : 'Recent transactions'}</h2><span className="rounded-full bg-[#eee8da] px-3 py-1 text-[10px] font-bold text-[#69746a]">{transactions.length}</span></div>
          {!transactions.length ? <EmptyState t={t} /> : <div className="divide-y divide-[#e8e0d2]">{transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} lang={lang} />)}</div>}</section>
      </div>
    </>}
  </main></Protected>;
}

function BalanceCard({ label, value, tone }: { label: string; value: number; tone?: 'dark' }) {
  return <div className={`rounded-[20px] p-5 sm:p-6 ${tone === 'dark' ? 'bg-[#204a3d] text-[#f7f1e5]' : 'border border-[#ded5c5] bg-[#fbf8f0]'}`}><p className={`text-xs font-semibold ${tone ? 'text-[#d0dbd1]' : 'text-muted-foreground'}`}>{label}</p><p className="display mt-3 text-3xl font-extrabold tracking-[-.05em]">{value.toFixed(2)} <span className="text-sm tracking-normal">SAR</span></p></div>;
}

function TransactionRow({ transaction, lang }: { transaction: WalletTransaction; lang: Lang }) {
  const status = transaction.status;
  return <div className="flex items-center gap-3 py-4" data-testid={`row-transaction-${transaction.id}`}><div className={`grid size-10 place-items-center rounded-full ${transaction.type === 'sale' ? 'bg-[#e2e9df] text-[#315a46]' : 'bg-[#f1e5d9] text-[#a85d40]'}`}>{transaction.type === 'sale' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{transaction.description}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(transaction.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA')} · {status}</p></div><p className={`text-sm font-extrabold ${transaction.type === 'sale' ? 'text-[#315a46]' : 'text-[#a85d40]'}`}>{transaction.type === 'sale' ? '+' : '−'}{transaction.amount.toFixed(2)} SAR</p></div>;
}

function PageHeading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return <div className="mb-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#b96c4d]">{kicker}</p><h1 className="display text-4xl font-extrabold tracking-[-.055em] text-[#203e34]">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{subtitle}</p></div>;
}

function AuthPage({ mode, lang, t }: { mode: 'sign-in' | 'sign-up'; lang: Lang; t: Copy }) {
  const isIn = mode === 'sign-in';
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const redirectPath = new URLSearchParams(window.location.search).get('redirect') || '';
  const safeRedirect = redirectPath.startsWith('/') && !redirectPath.startsWith('//') &&
    (!basePath || redirectPath === basePath || redirectPath.startsWith(`${basePath}/`));
  const redirectTo = safeRedirect ? redirectPath : `${basePath}/`;
  return <div className={`baqi-shell grain grid min-h-[100dvh] lg:grid-cols-[.85fr_1.15fr] ${lang === 'ar' ? 'arabic' : ''}`}>
    <aside className="relative hidden overflow-hidden bg-[#204a3d] px-10 py-12 text-[#f6f0e4] lg:flex lg:flex-col lg:justify-between xl:px-16">
      <Link href="/" className="inline-flex w-fit items-center gap-3 text-[#f6f0e4] no-underline"><div className="grid size-11 place-items-center rounded-xl bg-[#d7855e] text-xl font-extrabold">ب</div><span className="display text-2xl font-extrabold tracking-[-.06em]">baqi.</span></Link>
      <div className="relative z-10 max-w-lg"><p className="mb-5 text-[10px] font-bold uppercase tracking-[.2em] text-[#d9a17f]">A RIYADH MATERIALS EXCHANGE</p><h1 className="display text-6xl font-extrabold leading-[1.02] tracking-[-.06em]">{lang === 'ar' ? 'كل فائض له استخدام.' : 'Every leftover has another use.'}</h1><p className="mt-6 max-w-sm text-sm leading-7 text-[#d0dbd1]">{t.authHelp}</p></div>
      <div className="absolute -bottom-24 -right-24 size-[420px] rounded-full border border-[#89a68f]/25"><div className="absolute inset-12 rounded-full border border-[#89a68f]/25" /><div className="absolute inset-24 rounded-full border border-[#89a68f]/25" /></div>
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#b6c8b9]">BAQI / RIYADH, KSA</p>
    </aside>
    <main className="flex min-h-[100dvh] flex-col px-5 py-6 sm:px-10 lg:px-16">
      <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2 text-[#204a3d] no-underline lg:invisible"><span className="grid size-9 place-items-center rounded-xl bg-[#204a3d] text-lg font-bold text-white">ب</span><span className="display text-xl font-extrabold">baqi.</span></Link><Link href="/" className="text-sm font-semibold text-muted-foreground no-underline hover:text-primary">{t.back}</Link></div>
      <div className="mx-auto my-auto w-full max-w-[435px] py-12"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#b96c4d]">{isIn ? 'BAQI / MEMBER ACCESS' : 'BAQI / START HERE'}</p><h2 className="display text-4xl font-extrabold tracking-[-.055em] text-[#203e34]">{isIn ? t.signInTitle : t.signUpTitle}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{t.authHelp}</p>
        <div className="mt-8">
          {isIn ? (
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={redirectTo} />
          ) : (
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={redirectTo} />
          )}
        </div>
        <div className="mt-6 border-t border-[#e2d9c9] pt-5 text-center text-sm text-muted-foreground">{isIn ? (lang === 'ar' ? 'جديد على باقي؟' : 'New to Baqi?') : (lang === 'ar' ? 'لديك حساب بالفعل؟' : 'Already have an account?')} <Link href={isIn ? '/sign-up' : '/sign-in'} className="font-bold text-primary no-underline">{isIn ? t.createAccount : t.signIn}</Link></div>
      </div>
      <div className="text-center text-[10px] text-muted-foreground"><ShieldCheck size={13} className="mr-1 inline" />{lang === 'ar' ? 'دخول آمن إلى سوق مواد محلي' : 'Secure access to a local materials market'}</div>
    </main>
  </div>;
}

function NotFoundPage({ lang, t }: { lang: Lang; t: Copy }) {
  return <main className="mx-auto max-w-xl px-5 py-24 text-center"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b96c4d]">404 / BAQI</p><h1 className="display mt-3 text-5xl font-extrabold tracking-[-.06em] text-[#203e34]">{lang === 'ar' ? 'هذه الصفحة غير موجودة' : 'This page is not on the site map.'}</h1><p className="mt-4 text-sm text-muted-foreground">{t.error}</p><Link href="/" className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground no-underline">{t.discover}</Link></main>;
}

export default function BaqiApp() {
  const { lang, t, toggle } = useLanguage();
  return <Switch>
    <Route path="/sign-in/*?"><AuthPage mode="sign-in" lang={lang} t={t} /></Route>
    <Route path="/sign-up/*?"><AuthPage mode="sign-up" lang={lang} t={t} /></Route>
    <Route path="/"><PageFrame lang={lang} t={t} toggle={toggle}><Catalog lang={lang} t={t} /></PageFrame></Route>
    <Route path="/listing/:id"><PageFrame lang={lang} t={t} toggle={toggle}><ListingDetail lang={lang} t={t} /></PageFrame></Route>
    <Route path="/sell"><PageFrame lang={lang} t={t} toggle={toggle}><SellPage lang={lang} t={t} /></PageFrame></Route>
    <Route path="/messages"><PageFrame lang={lang} t={t} toggle={toggle}><MessagesPage lang={lang} t={t} /></PageFrame></Route>
    <Route path="/messages/:id"><PageFrame lang={lang} t={t} toggle={toggle}><ChatPage lang={lang} t={t} /></PageFrame></Route>
    <Route path="/orders"><PageFrame lang={lang} t={t} toggle={toggle}><OrdersPage lang={lang} t={t} /></PageFrame></Route>
    <Route path="/wallet"><PageFrame lang={lang} t={t} toggle={toggle}><WalletPage lang={lang} t={t} /></PageFrame></Route>
    <Route><PageFrame lang={lang} t={t} toggle={toggle}><NotFoundPage lang={lang} t={t} /></PageFrame></Route>
  </Switch>;
}
