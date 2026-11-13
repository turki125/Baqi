import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { getListConversationsQueryKey, useListConversations } from '@workspace/api-client-react';
import type { Listing } from '@workspace/api-client-react';
import {
  AlertCircle, ArrowLeft, BadgeCheck, CircleHelp, ImageOff, LockKeyhole, MapPin,
  MessageCircle, PackageOpen, Plus, RotateCcw, Search, SearchCheck, ShoppingBag, UserRound, X, FlaskConical,
} from 'lucide-react';
import { useLang } from './lang';
import { REQ, basePath, clearPrivateSessionState, initials, photoUrl, signInHref } from '@/lib/baqi';

export function cx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(' '); }

export function useMember() {
  const { user, isLoaded } = useUser();
  return { isLoaded, user: isLoaded && user ? {
    id: user.id,
    name: user.fullName || user.firstName || user.primaryEmailAddress?.emailAddress || '',
    email: user.primaryEmailAddress?.emailAddress || '',
  } : null };
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'accent';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-[#a9320d] shadow-card',
  accent: 'bg-accent text-accent-foreground hover:bg-[#df4815] shadow-card',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-[#f3e4dc]',
  outline: 'border border-input bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground hover:brightness-95',
};
export const btn = (variant: Variant = 'primary', size: 'md' | 'sm' | 'lg' = 'md') => cx(
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,transform,box-shadow,opacity] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 no-underline',
  size === 'sm' ? 'min-h-9 px-3 text-[13px]' : size === 'lg' ? 'min-h-[52px] px-6 text-[15px]' : 'min-h-11 px-4 text-sm',
  variants[variant],
);

export function Button({ children, variant = 'primary', size = 'md', className, testId, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'sm' | 'lg'; testId?: string }) {
  return <button type="button" data-testid={testId} className={cx(btn(variant, size), className)} {...rest}>{children}</button>;
}

export function Spinner() {
  return <span aria-hidden className="inline-block size-4 animate-spin rounded-full border-2 border-current border-e-transparent" />;
}

export function Field({ label, htmlFor, hint, error, children, optional }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode; optional?: boolean }) {
  const { tr } = useLang();
  return <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>{optional && <span className="text-xs font-normal text-muted-foreground">{tr('Optional', 'اختياري')}</span>}
    </label>
    {children}
    {error ? <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"><AlertCircle size={14} />{error}</p>
      : hint ? <p id={`${htmlFor}-hint`} className="text-[13px] leading-5 text-muted-foreground">{hint}</p> : null}
  </div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('min-w-0 rounded-2xl border border-border bg-card shadow-card', className)}>{children}</div>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1.5 max-w-xl text-[15px] leading-6 text-muted-foreground">{subtitle}</p>}</div>
    {action}
  </div>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground no-underline transition-colors hover:text-primary" data-testid="link-back">
    <ArrowLeft size={16} className="rtl-flip" />{children}</Link>;
}

export function SimulationNote({ children, className }: { children: ReactNode; className?: string }) {
  const { tr } = useLang();
  return <div className={cx('flex items-start gap-2.5 rounded-xl border border-[#f0d89f] bg-amber-soft px-3.5 py-3 text-[13px] leading-5 text-[#5b4211]', className)} data-testid="note-simulation">
    <FlaskConical size={16} className="mt-0.5 shrink-0" />
    <div><strong className="font-semibold">{tr('Simulation only. ', 'محاكاة فقط. ')}</strong>{children}</div>
  </div>;
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  const { tr } = useLang();
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy aria-label={tr('Loading', 'جارٍ التحميل')}>
    {Array.from({ length: count }, (_, i) => <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="shimmer aspect-[4/3]" /><div className="space-y-2.5 p-4"><div className="shimmer h-4 w-3/4 rounded" /><div className="shimmer h-4 w-1/3 rounded" /><div className="shimmer h-3 w-1/2 rounded" /></div>
    </div>)}
  </div>;
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  const { tr } = useLang();
  return <div className="space-y-3" aria-busy aria-label={tr('Loading', 'جارٍ التحميل')}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="shimmer size-12 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><div className="shimmer h-4 w-1/2 rounded" /><div className="shimmer h-3 w-1/3 rounded" /></div></div>)}
  </div>;
}

export function ErrorState({ retry, message }: { retry?: () => void; message?: string }) {
  const { tr } = useLang();
  return <div role="alert" className="rise mx-auto my-6 max-w-md rounded-2xl border border-border bg-card px-6 py-8 text-center" data-testid="status-error">
    <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-[#fdecea] text-destructive"><AlertCircle size={20} /></div>
    <p className="font-semibold">{message || tr('We could not load this right now.', 'تعذر التحميل الآن.')}</p>
    <p className="mt-1 text-sm text-muted-foreground">{tr('Check your connection and try again.', 'تحقق من الاتصال ثم حاول مرة أخرى.')}</p>
    {retry && <Button variant="outline" className="mt-5" onClick={retry} testId="button-retry"><RotateCcw size={15} />{tr('Try again', 'أعد المحاولة')}</Button>}
  </div>;
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="rise rounded-2xl border border-dashed border-input bg-card px-6 py-12 text-center" data-testid="status-empty">
    <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-secondary text-primary">{icon ?? <PackageOpen size={22} />}</div>
    <p className="text-base font-semibold">{title}</p>
    {body && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>;
}

export function Logo({ compact }: { compact?: boolean }) {
  return <span className={cx('baqi-wordmark', compact && 'baqi-wordmark-compact')} dir="ltr" lang="en" role="img" aria-label="Baqi">
    <span>baqi</span><span className="baqi-wordmark-dot" aria-hidden="true">.</span>
  </span>;
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'amber' | 'red' | 'green'; className?: string }) {
  const tones = {
    neutral: 'bg-muted text-foreground',
    teal: 'bg-secondary text-secondary-foreground',
    amber: 'bg-amber-soft text-[#6b4b0c]',
    red: 'bg-[#fdecea] text-destructive',
    green: 'bg-amber-soft text-primary',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function useConditionLabel() {
  const { tr } = useLang();
  return (c: Listing['condition']) => c === 'new' ? tr('New', 'جديد') : c === 'like_new' ? tr('Like new', 'شبه جديد') : tr('Used', 'مستعمل');
}

export function PhotoFallback({ className, label }: { className?: string; label?: string }) {
  const { tr } = useLang();
  return <div className={cx('grid h-full w-full place-items-center bg-[linear-gradient(135deg,#eef1f3,#e2e7ea)] text-muted-foreground', className)}>
    <div className="text-center"><ImageOff size={26} className="mx-auto mb-1.5 opacity-70" /><span className="text-xs font-medium">{label || tr('No photo yet', 'لا توجد صورة')}</span></div>
  </div>;
}

export function ListingPhoto({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = photoUrl(src);
  if (!url || failed) return <PhotoFallback className={className} />;
  return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cx('h-full w-full object-cover', className)} />;
}

export function PriceTag({ listing, size = 'md' }: { listing: Listing; size?: 'md' | 'lg' }) {
  const { tr, money } = useLang();
  if (listing.isFree) return <span className={cx('font-bold text-primary', size === 'lg' ? 'text-3xl' : 'text-lg')}>{tr('Free', 'مجاناً')}</span>;
  return <span className="num"><span className={cx('font-bold text-foreground', size === 'lg' ? 'text-3xl' : 'text-lg')}>{money(listing.unitPrice ?? 0)}</span>
    <span className="text-sm font-medium text-muted-foreground"> / <bdi>{listing.unit}</bdi></span></span>;
}

export function ListingCard({ listing }: { listing: Listing }) {
  const { tr, isAr, num } = useLang();
  const cond = useConditionLabel();
  return <Link href={`/listing/${listing.id}`} data-testid={`card-listing-${listing.id}`}
    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground no-underline shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift">
    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
      <ListingPhoto src={listing.photos?.[0]} alt={listing.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-card/95 px-2 py-1 text-xs font-semibold shadow-card">{cond(listing.condition)}</span>
        {listing.isFree && <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">{tr('Free', 'مجاني')}</span>}
      </div>
      {listing.photos.length > 1 && <span className="absolute bottom-3 end-3 rounded-md bg-foreground/75 px-2 py-0.5 text-[11px] font-semibold text-white num">{num(listing.photos.length)} {tr('photos', 'صور')}</span>}
    </div>
    <div className="flex flex-1 flex-col p-4">
      <p className="text-xs font-medium text-muted-foreground">{isAr ? listing.categoryNameAr : listing.categoryNameEn}</p>
      <h3 className="mt-1 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug">{listing.title}</h3>
      <div className="mt-2"><PriceTag listing={listing} /></div>
      <p className="mt-0.5 text-[13px] text-muted-foreground num">{num(listing.quantity)} <bdi>{listing.unit}</bdi> {tr('available', 'متاح')}
        {listing.saleMode === 'full_lot' && <> · {tr('Full lot', 'الكمية كاملة')}</>}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px] text-muted-foreground" style={{ marginTop: 14 }}>
        <span className="flex min-w-0 items-center gap-1"><MapPin size={14} className="shrink-0" /><span className="truncate"><bdi>{listing.neighborhood}</bdi></span></span>
        <span className="flex min-w-0 items-center gap-1 font-medium text-foreground">{listing.sellerTrusted && <BadgeCheck size={15} className="shrink-0 text-primary" aria-label={tr('Trusted seller', 'بائع موثوق')} />}<span className="truncate"><bdi>{listing.sellerName}</bdi></span></span>
      </div>
    </div>
  </Link>;
}

export function Modal({ open, onOpenChange, title, description, children, side = 'center', wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; side?: 'center' | 'bottom'; wide?: boolean;
}) {
  const { tr } = useLang();
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#182226]/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content className={cx('fixed z-50 flex max-h-[92dvh] flex-col bg-card shadow-lift outline-none',
        side === 'bottom' ? 'inset-x-0 bottom-0 rounded-t-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-10'
          : cx('left-1/2 top-1/2 w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0', wide ? 'max-w-4xl' : 'max-w-lg'))}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div><DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}</div>
          <DialogPrimitive.Close className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={tr('Close', 'إغلاق')} data-testid="button-close-dialog"><X size={18} /></DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export function Protected({ children, reason }: { children: ReactNode; reason?: string }) {
  const { isLoaded, user } = useMember();
  const { tr } = useLang();
  const [location] = useLocation();
  if (!isLoaded) return <main className="mx-auto max-w-5xl px-4 py-10"><SkeletonRows /></main>;
  if (!user) return <main className="mx-auto max-w-md px-4 py-16 text-center rise">
    <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-secondary text-primary"><LockKeyhole size={22} /></div>
    <h1 className="text-2xl font-bold">{tr('Sign in to continue', 'سجّل الدخول للمتابعة')}</h1>
    <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{reason || tr('Your account keeps reservations, messages and wallet activity together.', 'يجمع حسابك الحجوزات والرسائل ونشاط المحفظة في مكان واحد.')}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <Link href={signInHref(location + window.location.search)} className={btn('primary')} data-testid="link-protected-sign-in">{tr('Sign in', 'تسجيل الدخول')}</Link>
      <Link href={`/sign-up?redirect=${encodeURIComponent(basePath + location)}`} className={btn('outline')} data-testid="link-protected-sign-up">{tr('Create account', 'إنشاء حساب')}</Link>
    </div>
  </main>;
  return <>{children}</>;
}

export function useSignOut() {
  const { signOut } = useClerk();
  const qc = useQueryClient();
  return () => { clearPrivateSessionState(); qc.clear(); void signOut({ redirectUrl: basePath || '/' }); };
}

/** Total unread across the inbox, including Baqi Alerts. Messages is the only in-app alert destination. */
export function useUnreadMessages() {
  const { user } = useMember();
  const q = useListConversations({ query: { queryKey: getListConversationsQueryKey(), enabled: !!user, refetchInterval: 30_000, refetchIntervalInBackground: false }, request: REQ });
  return user ? (q.data ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) : 0;
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  const { tr, num } = useLang();
  if (!count) return null;
  return <span className={cx('pop inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-accent-foreground ring-2 ring-card num', className)} data-testid="badge-unread-messages">
    <span aria-hidden>{count > 99 ? '99+' : num(count)}</span><span className="sr-only">{tr(`${count} unread`, `${count} غير مقروءة`)}</span></span>;
}

function isActive(location: string, href: string) {
  return href === '/' ? location === '/' || location.startsWith('/listing') : location.startsWith(href);
}

export function Header() {
  const { tr } = useLang();
  const [location] = useLocation();
  const { user } = useMember();
  const unread = useUnreadMessages();
  const nav = [
    { href: '/', label: tr('Browse', 'تصفح'), icon: Search },
    { href: '/messages', label: tr('Messages', 'الرسائل'), icon: MessageCircle },
    { href: '/orders', label: tr('Orders', 'الطلبات'), icon: ShoppingBag },
  ];
  return <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
      <Link href="/" className="shrink-0 rounded-lg text-foreground no-underline" data-testid="link-home" aria-label={tr('Baqi home', 'الصفحة الرئيسية لباقي')}><Logo /></Link>
      <nav className="ms-4 hidden items-center gap-1 lg:flex" aria-label={tr('Main', 'الرئيسية')}>
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(location, href) ? 'page' : undefined}
          data-testid={`link-nav-${href.slice(1) || 'browse'}`}
          className={cx('inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold no-underline transition-colors', isActive(location, href) ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <Icon size={17} /><span>{label}</span>{href === '/messages' && <UnreadBadge count={unread} />}</Link>)}
      </nav>
      <div className="ms-auto flex items-center gap-1.5">
        <Link href="/help" className="hidden size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:grid" aria-label={tr('Help', 'المساعدة')} data-testid="link-help"><CircleHelp size={19} /></Link>
        {user && <Link href="/account/alerts" className={cx(btn('ghost', 'sm'), 'hidden min-h-10 lg:inline-flex', location.startsWith('/account/alerts') && 'bg-secondary text-primary')} data-testid="link-header-alerts"><SearchCheck size={17} />{tr('Manage my alerts', 'إدارة تنبيهاتي')}</Link>}
        <div className="hidden items-center gap-1.5 md:flex">
        <Link href="/sell" className={btn('primary')} data-testid="link-sell"><Plus size={17} />{tr('Sell materials', 'بِع موادك')}</Link>
        {user ? <Link href="/account" aria-label={tr('Account', 'الحساب')} title={user.name} data-testid="link-account"
          className={cx('grid size-10 place-items-center rounded-full text-sm font-bold no-underline', location.startsWith('/account') || location.startsWith('/wallet') ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary hover:bg-[#f3e4dc]')}>{initials(user.name)}</Link>
          : <Link href={signInHref(location)} className={btn('outline')} data-testid="link-sign-in">{tr('Sign in', 'تسجيل الدخول')}</Link>}
        </div>
      </div>
    </div>
  </header>;
}

export function MobileNav() {
  const { tr } = useLang();
  const [location] = useLocation();
  const unread = useUnreadMessages();
  const items = [
    { href: '/', label: tr('Browse', 'تصفح'), icon: Search },
    { href: '/messages', label: tr('Messages', 'الرسائل'), icon: MessageCircle },
    { href: '/sell', label: tr('Sell', 'بيع'), icon: Plus, primary: true },
    { href: '/orders', label: tr('Orders', 'الطلبات'), icon: ShoppingBag },
    { href: '/account', label: tr('Account', 'الحساب'), icon: UserRound },
  ];
  return <nav aria-label={tr('Main', 'الرئيسية')} className="mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/97 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 lg:hidden">
    <ul className="grid h-16 grid-cols-5">
      {items.map(({ href, label, icon: Icon, primary }) => {
        const active = href === '/account' ? location.startsWith('/account') || location.startsWith('/wallet') || location.startsWith('/help') : isActive(location, href);
        return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} data-testid={`link-mobile-${href.slice(1) || 'browse'}`}
          className={cx('flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold no-underline', active ? 'text-primary' : 'text-muted-foreground')}>
          <span className={cx('relative grid place-items-center rounded-lg transition-colors', primary ? 'size-8 bg-primary text-primary-foreground' : cx('h-7 w-11', active && 'bg-secondary'))}><Icon size={primary ? 18 : 19} />{href === '/messages' && <UnreadBadge count={unread} className="absolute -top-1 end-0.5" />}</span>
          <span className="max-w-full truncate px-0.5">{label}</span></Link></li>;
      })}
    </ul>
  </nav>;
}

export function Shell({ children }: { children: ReactNode }) {
  const { tr } = useLang();
  return <div className="min-h-[100dvh] pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">{tr('Skip to content', 'انتقل إلى المحتوى')}</a>
    <Header />
    <div id="main">{children}</div>
    <MobileNav />
  </div>;
}
