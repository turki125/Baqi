import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmtDate, fmtMoney, fmtNum, fmtTime, type Lang } from '@/lib/baqi';
import { useLocation } from 'wouter';

type LangCtx = {
  lang: Lang;
  isAr: boolean;
  toggle: () => void;
  /** Pick the English or Arabic string for interface copy. Never used on user content. */
  tr: (en: string, ar: string) => string;
  money: (v: number) => string;
  num: (v: number) => string;
  date: (v: string) => string;
  time: (v: string) => string;
};

const Ctx = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('baqi-language') === 'ar' ? 'ar' : 'en'));
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const labels: [string, string, string][] = [
      ['/sign-in', 'Sign in', 'تسجيل الدخول'], ['/sign-up', 'Create account', 'إنشاء حساب'],
      ['/listing/', 'Material details', 'تفاصيل المادة'], ['/sell', 'Sell materials', 'بِع موادك'],
      ['/messages/', 'Conversation', 'المحادثة'], ['/messages', 'Messages', 'الرسائل'],
      ['/orders/', 'Order details', 'تفاصيل الطلب'], ['/orders', 'Orders', 'الطلبات'],
      ['/wallet', 'Wallet', 'المحفظة'], ['/account', 'Account', 'الحساب'], ['/help', 'Help', 'المساعدة'],
    ];
    const label = labels.find(([path]) => location.startsWith(path));
    const title = label ? `${label[lang === 'ar' ? 2 : 1]} · ${lang === 'ar' ? 'باقي' : 'Baqi'}`
      : location === '/' ? (lang === 'ar' ? 'باقي · سوق فائض مواد البناء في الرياض' : 'Baqi · Riyadh surplus building materials')
      : (lang === 'ar' ? 'الصفحة غير موجودة · باقي' : 'Page not found · Baqi');
    document.title = title;
    const description = lang === 'ar'
      ? 'اشترِ وبِع وتبرّع بفائض مواد البناء في الرياض. تصفح المواد ورتّب الاستلام مع البائع.'
      : 'Buy, sell and give away surplus building materials in Riyadh. Browse materials and arrange pickup with sellers.';
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector(selector)?.setAttribute('content', description);
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) document.querySelector(selector)?.setAttribute('content', title);
  }, [lang, location]);
  useEffect(() => {
    localStorage.setItem('baqi-language', lang);
    window.dispatchEvent(new CustomEvent('baqi-language-change', { detail: lang }));
  }, [lang]);
  const toggle = useCallback(() => {
    setLang((current) => current === 'en' ? 'ar' : 'en');
  }, []);
  const value = useMemo<LangCtx>(() => ({
    lang, isAr: lang === 'ar', toggle,
    tr: (en, ar) => (lang === 'ar' ? ar : en),
    money: (v) => fmtMoney(v, lang),
    num: (v) => fmtNum(v, lang),
    date: (v) => fmtDate(v, lang),
    time: (v) => fmtTime(v, lang),
  }), [lang, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
