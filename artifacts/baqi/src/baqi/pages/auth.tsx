import { Link, useSearch } from 'wouter';
import { SignIn, SignUp } from '@clerk/react';
import { ArrowLeft, Languages, MessageCircle, Search, Truck } from 'lucide-react';
import { useLang } from '../lang';
import { Logo, btn, cx } from '../ui';
import { basePath, safeRedirect } from '@/lib/baqi';

export default function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { tr, toggle, isAr } = useLang();
  const search = useSearch();
  const isIn = mode === 'sign-in';
  const redirectTo = safeRedirect(search);
  const qs = new URLSearchParams(search).get('redirect') ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
  const points = [
    { icon: Search, t: tr('Find surplus materials across Riyadh', 'اعثر على فائض المواد في أنحاء الرياض') },
    { icon: MessageCircle, t: tr('Message sellers and reserve quantities', 'راسل البائعين واحجز الكميات') },
    { icon: Truck, t: tr('Track pickup and orders in one place', 'تابع الاستلام والطلبات في مكان واحد') },
  ];
  return <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
      <Link href="/" className="w-fit rounded-lg text-primary-foreground no-underline [&_span]:!text-primary-foreground"><Logo /></Link>
      <div className="max-w-md">
        <h1 className="text-[34px] font-bold leading-tight">{tr('Build for less. Give surplus a second life.', 'ابنِ بتكلفة أقل. وامنح فائض المواد فرصة جديدة.')}</h1>
        <ul className="mt-8 space-y-4">{points.map((p) => <li key={p.t} className="flex items-center gap-3 text-[15px] text-white/90"><span className="grid size-9 place-items-center rounded-lg bg-white/12"><p.icon size={17} /></span>{p.t}</li>)}</ul>
      </div>
      <p className="text-xs text-white/70">{tr('Payments in this version are simulations.', 'المدفوعات في هذه النسخة محاكاة.')}</p>
    </aside>
    <main className="flex min-h-[100dvh] flex-col px-4 py-5 sm:px-8">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground no-underline hover:text-primary" data-testid="link-auth-back"><ArrowLeft size={16} className="rtl-flip" />{tr('Back to Baqi', 'العودة إلى باقي')}</Link>
        <button type="button" onClick={toggle} className={btn('ghost', 'sm')} data-testid="button-auth-language"><Languages size={16} /><span lang={isAr ? 'en' : 'ar'}>{isAr ? 'English' : 'العربية'}</span></button>
      </div>
      <div className="mx-auto my-auto w-full max-w-[440px] py-8">
        <div className="mb-6 lg:hidden"><Logo /></div>
        <h2 className="text-2xl font-bold">{isIn ? tr('Welcome back', 'مرحباً بعودتك') : tr('Create your Baqi account', 'أنشئ حساب باقي')}</h2>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{tr('Your account keeps reservations, messages and wallet activity together.', 'يجمع حسابك الحجوزات والرسائل ونشاط المحفظة في مكان واحد.')}</p>
        <div className="mt-6" dir={isAr ? 'rtl' : 'ltr'}>
          {isIn
            ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up${qs}`} forceRedirectUrl={redirectTo} />
            : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in${qs}`} forceRedirectUrl={redirectTo} />}
        </div>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isIn ? tr('New to Baqi?', 'جديد على باقي؟') : tr('Already have an account?', 'لديك حساب بالفعل؟')}{' '}
          <Link href={`${isIn ? '/sign-up' : '/sign-in'}${qs}`} className={cx('font-semibold text-primary')} data-testid="link-auth-switch">{isIn ? tr('Create an account', 'أنشئ حساباً') : tr('Sign in', 'تسجيل الدخول')}</Link>
        </p>
      </div>
    </main>
  </div>;
}
