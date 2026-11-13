import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetWalletQueryKey, useAskHelp, useGetWallet, useRequestWithdrawal } from '@workspace/api-client-react';
import type { WalletTransaction } from '@workspace/api-client-react';
import { SearchCheck, ArrowDownLeft, ArrowUpRight, ChevronRight, CircleHelp, Home, Languages, LogOut, MessageCircle, Plus, Send, ShoppingBag, Wallet } from 'lucide-react';
import { useLang } from '../lang';
import { BackLink, Badge, Button, Card, EmptyState, ErrorState, Field, PageTitle, Protected, SimulationNote, SkeletonRows, Spinner, btn, cx, useMember, useSignOut } from '../ui';
import { REQ, basePath, initials, signInHref } from '@/lib/baqi';

export function AccountPage() {
  const { tr, toggle, isAr } = useLang();
  const { user, isLoaded } = useMember();
  const signOut = useSignOut();
  const rows = [
    { href: '/orders', icon: ShoppingBag, t: tr('Orders', 'الطلبات'), s: tr('Reservations, pickups and payments', 'الحجوزات والاستلام والمدفوعات') },
    { href: '/messages', icon: MessageCircle, t: tr('Messages', 'الرسائل'), s: tr('Conversations with buyers and sellers', 'المحادثات مع البائعين والمشترين') },
    { href: '/account/alerts', icon: SearchCheck, t: 'إدارة تنبيهاتي', s: tr('Saved searches, pause, resume and email', 'عمليات البحث المحفوظة والإيقاف والبريد') },
    { href: '/wallet', icon: Wallet, t: tr('Wallet', 'المحفظة'), s: tr('Sale proceeds and simulated withdrawals', 'عوائد البيع والسحوبات التجريبية') },
    { href: '/sell', icon: Plus, t: tr('Sell materials', 'بِع موادك'), s: tr('List surplus in three steps', 'اعرض الفائض في ثلاث خطوات') },
    { href: '/help', icon: CircleHelp, t: tr('Help', 'المساعدة'), s: tr('Deposits, pickup and how Baqi works', 'العربون والاستلام وطريقة عمل باقي') },
  ];
  return <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <PageTitle title={tr('Account', 'الحساب')} />
    {!isLoaded ? <SkeletonRows rows={2} /> : user ? <Card className="mb-5 flex items-center gap-4 p-5">
      <span className="grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">{initials(user.name)}</span>
      <div className="min-w-0"><p className="truncate text-lg font-semibold" data-testid="text-account-name"><bdi>{user.name}</bdi></p><p className="truncate text-sm text-muted-foreground" dir="ltr" style={{ textAlign: isAr ? 'right' : 'left' }}>{user.email}</p></div>
    </Card> : <Card className="mb-5 p-5">
      <p className="font-semibold">{tr('You are browsing as a guest', 'أنت تتصفح كزائر')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr('Sign in to reserve materials, message sellers and publish listings.', 'سجّل الدخول لحجز المواد ومراسلة البائعين ونشر الإعلانات.')}</p>
      <div className="mt-4 flex gap-2"><Link href={signInHref('/account')} className={btn('primary')} data-testid="link-account-sign-in">{tr('Sign in', 'تسجيل الدخول')}</Link><Link href={`/sign-up?redirect=${encodeURIComponent(basePath + '/account')}`} className={btn('outline')}>{tr('Create account', 'إنشاء حساب')}</Link></div>
    </Card>}
    <Card className="overflow-hidden">
      <ul>{rows.map((r) => <li key={r.href} className="border-b border-border last:border-b-0">
        <Link href={r.href} className="flex min-h-16 items-center gap-4 px-5 py-3 text-foreground no-underline hover:bg-muted/60" data-testid={`link-account-${r.href.slice(1).replace('/', '-')}`}>
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><r.icon size={19} /></span>
          <span className="flex-1"><span className="block font-semibold">{r.t}</span><span className="block text-[13px] text-muted-foreground">{r.s}</span></span>
          <ChevronRight size={18} className="rtl-flip text-muted-foreground" /></Link></li>)}
        <li className="border-t border-border"><button type="button" onClick={toggle} className="flex min-h-14 w-full items-center gap-4 px-5 text-start hover:bg-muted/60" data-testid="button-account-language">
          <span className="grid size-10 place-items-center rounded-xl bg-muted"><Languages size={19} /></span><span className="flex-1 font-semibold">{tr('Language', 'اللغة')}</span><span className="text-sm text-muted-foreground">{isAr ? 'English' : 'العربية'}</span></button></li>
      </ul>
    </Card>
    {user && <Button variant="outline" className="mt-5 w-full" onClick={signOut} testId="button-sign-out"><LogOut size={16} className="rtl-flip" />{tr('Sign out', 'تسجيل الخروج')}</Button>}
  </main>;
}

export function WalletPage() {
  return <Protected><WalletView /></Protected>;
}

function WalletView() {
  const { tr, money, date } = useLang();
  const wallet = useGetWallet({ request: REQ });
  const withdrawal = useRequestWithdrawal({ request: REQ });
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState<'bank' | 'wallet'>('bank');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const lock = useRef(false);
  const statusLabel = (s: WalletTransaction['status']) => ({ available: tr('Available', 'متاح'), pending: tr('Pending', 'قيد الانتظار'), completed: tr('Completed', 'مكتمل'), failed: tr('Failed', 'فشل') })[s];
  const tone = (s: WalletTransaction['status']) => s === 'completed' ? 'green' as const : s === 'pending' ? 'amber' as const : s === 'failed' ? 'red' as const : 'teal' as const;
  const description = (tx: WalletTransaction) => {
    if (tx.type === 'sale' && tx.description.startsWith('Completed sale: ')) {
      return tr('Completed sale: ', 'بيع مكتمل: ') + tx.description.slice('Completed sale: '.length);
    }
    if (tx.description === 'Demo withdrawal to bank') return tr('Demo withdrawal to bank', 'سحب تجريبي إلى حساب بنكي');
    if (tx.description === 'Demo withdrawal to wallet') return tr('Demo withdrawal to wallet', 'سحب تجريبي إلى محفظة');
    return tx.description;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault(); setError(''); setDone('');
    const value = Number(amount);
    const available = wallet.data?.available ?? 0;
    if (!(value > 0)) { setError(tr('Enter an amount greater than zero.', 'أدخل مبلغاً أكبر من صفر.')); return; }
    if (value > available + 1e-9) { setError(tr(`You can withdraw up to ${money(available)}.`, `يمكنك سحب ما يصل إلى ${money(available)}.`)); return; }
    if (lock.current) return;
    lock.current = true;
    withdrawal.mutate({ data: { amount: value, destination } }, {
      onSuccess: async () => { lock.current = false; setAmount(''); setDone(tr('Simulated withdrawal recorded. No money was transferred.', 'تم تسجيل السحب التجريبي. لم يتم تحويل أي أموال.')); await qc.invalidateQueries({ queryKey: getGetWalletQueryKey() }); },
      onError: () => { lock.current = false; setError(tr('The simulated withdrawal could not be recorded. Try again.', 'تعذر تسجيل السحب التجريبي. حاول مرة أخرى.')); },
    });
  };

  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <BackLink href="/account">{tr('Account', 'الحساب')}</BackLink>
    <PageTitle title={tr('Wallet', 'المحفظة')} subtitle={tr('Proceeds from materials you sold on Baqi.', 'عوائد المواد التي بعتها على باقي.')} />
    {wallet.isLoading ? <SkeletonRows rows={3} /> : wallet.isError || !wallet.data ? <ErrorState retry={() => void wallet.refetch()} /> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-card"><p className="text-sm text-white/80">{tr('Available', 'متاح')}</p><p className="mt-1 text-2xl font-bold num" data-testid="text-wallet-available">{money(wallet.data.available)}</p><p className="mt-1 text-xs text-white/75">{tr('Ready for simulated withdrawal', 'جاهز للسحب التجريبي')}</p></div>
        <Card className="p-5"><p className="text-sm text-muted-foreground">{tr('Pending', 'قيد الانتظار')}</p><p className="mt-1 text-2xl font-bold num">{money(wallet.data.pending)}</p><p className="mt-1 text-xs text-muted-foreground">{tr('Not yet available', 'غير متاح بعد')}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">{tr('Completed', 'مكتمل')}</p><p className="mt-1 text-2xl font-bold num">{money(wallet.data.completed)}</p><p className="mt-1 text-xs text-muted-foreground">{tr('Already withdrawn', 'تم سحبه')}</p></Card>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="p-5">
          <form onSubmit={submit} noValidate className="space-y-4">
            <h2 className="text-base font-semibold">{tr('Simulated withdrawal', 'سحب تجريبي')}</h2>
            <SimulationNote>{tr('Withdrawals are demonstrations. No bank transfer is made.', 'السحوبات للعرض فقط. لا يتم أي تحويل بنكي.')}</SimulationNote>
            <Field label={tr('Amount (SAR)', 'المبلغ (ر.س)')} htmlFor="w-amount" error={error || undefined} hint={tr(`Up to ${money(wallet.data.available)}`, `حتى ${money(wallet.data.available)}`)}>
              <input id="w-amount" type="number" inputMode="decimal" min="0" step=".01" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} className="field num" aria-invalid={!!error} data-testid="input-withdrawal-amount" />
            </Field>
            <fieldset><legend className="mb-2 text-sm font-semibold">{tr('Destination', 'الوجهة')}</legend>
              <div className="grid grid-cols-2 gap-2">{(['bank', 'wallet'] as const).map((dst) => <label key={dst} className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold', destination === dst ? 'border-primary bg-secondary text-primary' : 'border-input hover:bg-muted')}>
                <input type="radio" name="dest" checked={destination === dst} onChange={() => setDestination(dst)} className="accent-[#075E54]" data-testid={`radio-destination-${dst}`} />{dst === 'bank' ? tr('Bank account', 'حساب بنكي') : tr('Digital wallet', 'محفظة رقمية')}</label>)}</div>
            </fieldset>
            <Button type="submit" className="w-full" disabled={withdrawal.isPending || wallet.data.available <= 0} testId="button-request-withdrawal">{withdrawal.isPending ? <Spinner /> : null}{tr('Simulate withdrawal', 'محاكاة السحب')}</Button>
            {done && <p role="status" className="pop rounded-xl bg-[#e4f3ea] p-3 text-sm font-medium text-success" data-testid="status-withdrawal-success">{done}</p>}
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold">{tr('Transactions', 'المعاملات')}</h2>
          {!wallet.data.transactions.length ? <div className="mt-3"><EmptyState icon={<Wallet size={22} />} title={tr('No transactions yet', 'لا توجد معاملات بعد')} body={tr('Sales appear here after buyers complete their orders.', 'تظهر المبيعات هنا بعد أن يكمل المشترون طلباتهم.')} action={<Link href="/sell" className={btn('outline')}>{tr('Sell materials', 'بِع موادك')}</Link>} /></div> :
            <ul className="mt-3 divide-y divide-border">{wallet.data.transactions.map((tx) => <li key={tx.id} className="flex items-center gap-3 py-3" data-testid={`row-transaction-${tx.id}`}>
              <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tx.type === 'sale' ? 'bg-[#e4f3ea] text-success' : 'bg-muted text-foreground')}>{tx.type === 'sale' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tx.type === 'sale' ? tr('Sale', 'بيع') : tr('Simulated withdrawal', 'سحب تجريبي')}</p><p className="truncate text-[13px] text-muted-foreground" dir="auto">{description(tx)}</p><p className="text-xs text-muted-foreground">{date(tx.createdAt)}</p></div>
              <div className="text-end"><p className={cx('text-sm font-bold num', tx.type === 'sale' ? 'text-success' : '')}>{tx.type === 'sale' ? '+' : '-'}{money(Math.abs(tx.amount))}</p><Badge tone={tone(tx.status)} className="mt-1">{statusLabel(tx.status)}</Badge></div>
            </li>)}</ul>}
        </Card>
      </div>
    </>}
  </main>;
}

export function HelpPage() {
  const { tr, lang } = useLang();
  const [question, setQuestion] = useState('');
  const ask = useAskHelp({ request: REQ });
  const faqs = [
    [tr('How does the deposit work?', 'كيف يعمل العربون؟'), tr('Paid reservations ask for a 10% deposit to hold the materials. The balance is settled after you confirm pickup. In this version all payments are simulations and no money moves.', 'تتطلب الحجوزات المدفوعة عربوناً بنسبة ١٠٪ لتثبيت المواد. يُسدد المتبقي بعد تأكيد الاستلام. في هذه النسخة جميع المدفوعات محاكاة ولا تنتقل أي أموال.')],
    [tr('How do I arrange pickup?', 'كيف أرتّب الاستلام؟'), tr('Each listing shows the neighborhood and pickup details. Message the seller to agree on a time and bring suitable transport.', 'يعرض كل إعلان الحي وتفاصيل الاستلام. راسل البائع للاتفاق على موعد وأحضر وسيلة نقل مناسبة.')],
    [tr('What about free materials?', 'ماذا عن المواد المجانية؟'), tr('Free listings use a pickup request. No deposit or payment is needed.', 'تستخدم الإعلانات المجانية طلب استلام. لا حاجة لعربون أو دفع.')],
    [tr('Why did my quantity change?', 'لماذا تغيرت الكمية؟'), tr('Some sellers sell in fixed steps or only as a full lot. Your quantity rounds up to the next step and you confirm before reserving.', 'يبيع بعض البائعين بمضاعفات ثابتة أو الكمية كاملة فقط. تُقرَّب كميتك للمضاعف التالي وتؤكد ذلك قبل الحجز.')],
  ];
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <PageTitle title={tr('Help', 'المساعدة')} subtitle={tr('Answers about reservations, pickup and selling on Baqi.', 'إجابات حول الحجز والاستلام والبيع على باقي.')} />
    <Card className="p-5">
      <form onSubmit={(e) => { e.preventDefault(); if (question.trim() && !ask.isPending) ask.mutate({ data: { question: question.trim(), language: lang } }); }} className="space-y-3">
        <Field label={tr('Ask a question', 'اطرح سؤالاً')} htmlFor="help-q">
          <div className="flex gap-2">
            <input id="help-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} dir="auto" placeholder={tr('e.g. When do I pay the balance?', 'مثال: متى أدفع المبلغ المتبقي؟')} className="field flex-1" data-testid="input-help-question" />
            <Button type="submit" disabled={!question.trim() || ask.isPending} aria-label={tr('Send question', 'أرسل السؤال')} testId="button-send-help">{ask.isPending ? <Spinner /> : <Send size={16} className="rtl-flip" />}</Button>
          </div>
        </Field>
        {ask.data && <div className="pop rounded-xl bg-secondary p-4 text-[15px] leading-7 text-secondary-foreground" role="status" data-testid="text-help-answer">
          <p className="whitespace-pre-line" dir="auto">{ask.data.answer}</p>
          {ask.data.supportReferral && <p className="mt-2 border-t border-primary/15 pt-2 text-[13px] font-semibold">{tr('This may need a decision from our support team.', 'قد يتطلب هذا قراراً من فريق الدعم.')}</p>}
        </div>}
        {ask.isError && <p role="alert" className="text-sm text-destructive">{tr('We could not answer right now. Try again shortly.', 'تعذرت الإجابة الآن. حاول بعد قليل.')}</p>}
      </form>
    </Card>
    <h2 className="mb-3 mt-8 text-lg font-semibold">{tr('Common questions', 'أسئلة شائعة')}</h2>
    <div className="space-y-2">{faqs.map(([q, a]) => <details key={q} className="group rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-semibold">{q}<ChevronRight size={17} className="rtl-flip shrink-0 transition-transform group-open:rotate-90" /></summary>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{a}</p></details>)}</div>
  </main>;
}

export function NotFoundPage() {
  const { tr } = useLang();
  return <main className="mx-auto max-w-md px-4 py-20 text-center rise">
    <p className="text-sm font-semibold text-primary num">404</p>
    <h1 className="mt-2 text-2xl font-bold">{tr('This page does not exist', 'هذه الصفحة غير موجودة')}</h1>
    <p className="mt-2 text-[15px] text-muted-foreground">{tr('The link may be outdated, or the listing was removed.', 'ربما الرابط قديم أو أُزيل الإعلان.')}</p>
    <Link href="/" className={cx(btn('primary'), 'mt-6')} data-testid="link-not-found-home"><Home size={16} />{tr('Browse materials', 'تصفح المواد')}</Link>
  </main>;
}
