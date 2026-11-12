import { useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetListingQueryKey, getGetWalletQueryKey, getListConversationsQueryKey, getListOrdersQueryKey,
  useConfirmOrderReceipt, useCreateConversation, useGetListing, useListOrders, usePayOrderBalance, usePayOrderDeposit,
} from '@workspace/api-client-react';
import type { Order } from '@workspace/api-client-react';
import { ArrowRight, Check, CheckCircle2, CreditCard, MessageCircle, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import { useLang } from '../lang';
import { BackLink, Badge, Button, Card, EmptyState, ErrorState, PageTitle, Protected, SimulationNote, SkeletonRows, Spinner, btn, cx, useMember } from '../ui';
import { REQ } from '@/lib/baqi';

const POLL = { refetchInterval: 15_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true };

export function useStatusLabel() {
  const { tr } = useLang();
  return (s: Order['status']) => ({
    pending_deposit: tr('Deposit due', 'بانتظار العربون'),
    awaiting_pickup: tr('Awaiting pickup', 'بانتظار الاستلام'),
    balance_due: tr('Balance due', 'المتبقي مستحق'),
    completed: tr('Completed', 'مكتمل'),
    free_pickup: tr('Free pickup', 'استلام مجاني'),
  })[s];
}
const statusTone = (s: Order['status']) => s === 'completed' ? 'green' as const : s === 'pending_deposit' || s === 'balance_due' ? 'amber' as const : 'teal' as const;

/** Resolves whether the signed-in member is the buyer by checking the listing's seller. */
function useRole(order: Order) {
  const { user } = useMember();
  const listing = useGetListing(order.listingId, { query: { enabled: !!order.listingId, queryKey: getGetListingQueryKey(order.listingId), retry: 0 }, request: REQ });
  if (listing.isLoading) return 'loading' as const;
  if (listing.data && user && listing.data.sellerId === user.id) return 'seller' as const;
  if (listing.data && user) return 'buyer' as const;
  return 'unknown' as const;
}

function Timeline({ order }: { order: Order }) {
  const { tr } = useLang();
  const isFree = order.total === 0;
  const steps = isFree
    ? [{ key: 'req', label: tr('Pickup requested', 'تم طلب الاستلام') }, { key: 'pick', label: tr('Collect from seller', 'الاستلام من البائع') }, { key: 'completed', label: tr('Completed', 'مكتمل') }]
    : [
      { key: 'pending_deposit', label: tr('Deposit', 'العربون') },
      { key: 'awaiting_pickup', label: tr('Pickup', 'الاستلام') },
      { key: 'balance_due', label: tr('Balance', 'المتبقي') },
      { key: 'completed', label: tr('Completed', 'مكتمل') },
    ];
  const current = order.status === 'free_pickup' ? 1 : steps.findIndex((s) => s.key === order.status);
  const doneAll = order.status === 'completed';
  return <ol className="flex items-start" aria-label={tr('Order progress', 'تقدم الطلب')}>
    {steps.map((s, i) => {
      const done = doneAll || i < current;
      const active = !doneAll && i === current;
      return <li key={s.key} className="flex flex-1 flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
        <div className="flex w-full items-center">
          <span className={cx('h-0.5 flex-1', i === 0 ? 'opacity-0' : done || active ? 'bg-primary' : 'bg-border')} />
          <span className={cx('grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold', done ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary bg-card text-primary' : 'border-border bg-card text-muted-foreground')}>
            {done ? <Check size={14} /> : i + 1}</span>
          <span className={cx('h-0.5 flex-1', i === steps.length - 1 ? 'opacity-0' : done ? 'bg-primary' : 'bg-border')} />
        </div>
        <span className={cx('mt-1.5 px-1 text-[12px] leading-4', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{s.label}</span>
      </li>;
    })}
  </ol>;
}

function Money({ order }: { order: Order }) {
  const { tr, money, num } = useLang();
  return <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/70 p-4 text-sm sm:grid-cols-4 num">
    <div><dt className="text-muted-foreground">{tr('Quantity', 'الكمية')}</dt><dd className="mt-0.5 font-semibold">{num(order.quantity)} <bdi>{order.unit}</bdi></dd></div>
    <div><dt className="text-muted-foreground">{tr('Total', 'الإجمالي')}</dt><dd className="mt-0.5 font-semibold">{order.total > 0 ? money(order.total) : tr('Free', 'مجاناً')}</dd></div>
    {order.total > 0 && <>
      <div><dt className="text-muted-foreground">{tr('Deposit (10%)', 'العربون (١٠٪)')}</dt><dd className="mt-0.5 font-semibold">{money(order.depositDue)}</dd></div>
      <div><dt className="text-muted-foreground">{tr('Balance', 'المتبقي')}</dt><dd className="mt-0.5 font-semibold">{money(order.balanceDue)}</dd></div>
    </>}
  </dl>;
}

function OrderCard({ order }: { order: Order }) {
  const { tr, date } = useLang();
  const statusLabel = useStatusLabel();
  const role = useRole(order);
  const next = role !== 'buyer' ? null
    : order.status === 'pending_deposit' ? tr('Simulate deposit', 'محاكاة دفع العربون')
    : order.status === 'awaiting_pickup' || order.status === 'free_pickup' ? tr('Confirm pickup', 'تأكيد الاستلام')
    : order.status === 'balance_due' ? tr('Simulate balance payment', 'محاكاة دفع المتبقي') : null;
  return <Card className="rise p-5">
    <article data-testid={`card-order-${order.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/orders/${order.id}`} className="text-base font-semibold text-foreground no-underline hover:text-primary">{order.listingTitle}</Link>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{date(order.createdAt)} · {role === 'seller' ? tr('You are the seller', 'أنت البائع') : role === 'buyer' ? tr('Your purchase', 'مشترياتك') : '\u00a0'}</p>
        </div>
        <Badge tone={statusTone(order.status)} className="shrink-0"><span data-testid={`status-order-${order.id}`}>{statusLabel(order.status)}</span></Badge>
      </div>
      <div className="mt-4"><Timeline order={order} /></div>
      <div className="mt-4"><Money order={order} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Link href={`/orders/${order.id}`} className={btn(next ? 'primary' : 'outline')} data-testid={`link-order-${order.id}`}>{next ?? tr('View details', 'عرض التفاصيل')}<ArrowRight size={16} className="rtl-flip" /></Link>
      </div>
    </article>
  </Card>;
}

export function OrdersPage() {
  return <Protected><OrdersList /></Protected>;
}

function OrdersList() {
  const { tr } = useLang();
  const orders = useListOrders({ query: { queryKey: getListOrdersQueryKey(), ...POLL }, request: REQ });
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <PageTitle title={tr('Orders', 'الطلبات')} subtitle={tr('Reservations, pickups and payments for materials you buy or sell.', 'الحجوزات والاستلام والمدفوعات للمواد التي تشتريها أو تبيعها.')} />
    {orders.isLoading ? <SkeletonRows /> : orders.isError ? <ErrorState retry={() => void orders.refetch()} /> :
      !orders.data?.length ? <EmptyState icon={<ShoppingBag size={22} />} title={tr('No orders yet', 'لا توجد طلبات بعد')} body={tr('When you reserve materials or request a free pickup, it will appear here.', 'عند حجز مواد أو طلب استلام مجاني سيظهر هنا.')}
        action={<Link href="/" className={btn('primary')}>{tr('Browse materials', 'تصفح المواد')}</Link>} /> :
      <div className="space-y-4">{orders.data.map((o) => <OrderCard key={o.id} order={o} />)}</div>}
  </main>;
}

export function OrderDetailPage() {
  return <Protected><OrderDetail /></Protected>;
}

function OrderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { tr } = useLang();
  const orders = useListOrders({ query: { queryKey: getListOrdersQueryKey(), ...POLL }, request: REQ });
  const order = orders.data?.find((o) => o.id === id);
  return <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
    <BackLink href="/orders">{tr('All orders', 'كل الطلبات')}</BackLink>
    {orders.isLoading ? <SkeletonRows rows={2} /> : orders.isError ? <ErrorState retry={() => void orders.refetch()} /> :
      !order ? <EmptyState title={tr('Order not found', 'الطلب غير موجود')} body={tr('It may belong to a different account.', 'ربما يخص حساباً آخر.')} action={<Link href="/orders" className={btn('outline')}>{tr('View orders', 'عرض الطلبات')}</Link>} />
        : <OrderView key={order.id} order={order} />}
  </main>;
}

function OrderView({ order }: { order: Order }) {
  const { tr, money, date } = useLang();
  const statusLabel = useStatusLabel();
  const search = useSearch();
  const isNew = new URLSearchParams(search).get('new') === '1';
  const role = useRole(order);
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [method, setMethod] = useState<'mada' | 'card'>('mada');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const lock = useRef(false);
  const payDeposit = usePayOrderDeposit({ request: REQ });
  const payBalance = usePayOrderBalance({ request: REQ });
  const confirm = useConfirmOrderReceipt({ request: REQ });
  const conversation = useCreateConversation({ request: REQ });
  const busy = payDeposit.isPending || payBalance.isPending || confirm.isPending;

  const patch = (updated: Order) => {
    qc.setQueryData<Order[]>(getListOrdersQueryKey(), (old) => old?.map((o) => (o.id === updated.id ? updated : o)));
    void qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };
  const run = (kind: 'deposit' | 'balance' | 'confirm') => {
    if (lock.current || busy) return;
    lock.current = true; setMessage(null);
    const onSuccess = (updated: Order) => {
      lock.current = false; patch(updated); setSimulateFailure(false);
      if (kind === 'balance') void qc.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      setMessage({ tone: 'ok', text: kind === 'deposit' ? tr('Deposit simulated. Next, arrange pickup with the seller.', 'تمت محاكاة العربون. الخطوة التالية: رتّب الاستلام مع البائع.')
        : kind === 'confirm' ? updated.status === 'completed'
          ? tr('Free pickup confirmed. This order is complete.', 'تم تأكيد الاستلام المجاني. اكتمل الطلب.')
          : tr('Pickup confirmed. The remaining balance is now due.', 'تم تأكيد الاستلام. المبلغ المتبقي مستحق الآن.')
        : tr('Balance simulated. This order is complete.', 'تمت محاكاة دفع المتبقي. اكتمل الطلب.') });
    };
    const onError = () => {
      lock.current = false;
      setMessage({ tone: 'err', text: kind === 'confirm' ? tr('Could not confirm pickup. Try again.', 'تعذر تأكيد الاستلام. حاول مرة أخرى.') : tr('The simulated payment did not go through. Your order is saved; you can try again.', 'لم تنجح محاكاة الدفع. طلبك محفوظ ويمكنك المحاولة مرة أخرى.') });
    };
    if (kind === 'deposit') payDeposit.mutate({ id: order.id, data: { method, simulateFailure } }, { onSuccess, onError });
    else if (kind === 'balance') payBalance.mutate({ id: order.id, data: { method, simulateFailure } }, { onSuccess, onError });
    else confirm.mutate({ id: order.id }, { onSuccess, onError });
  };
  const messageSeller = () => {
    if (conversation.isPending) return;
    conversation.mutate({ data: { listingId: order.listingId } }, { onSuccess: async (c) => { await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() }); setLocation(`/messages/${c.id}`); } });
  };
  const isBuyer = role === 'buyer';
  const payKind = order.status === 'pending_deposit' ? 'deposit' as const : order.status === 'balance_due' ? 'balance' as const : null;

  return <div className="space-y-5">
    {isNew && (order.status === 'pending_deposit' || order.status === 'free_pickup') && <div className="pop flex items-start gap-3 rounded-2xl border border-primary/25 bg-secondary p-4" role="status" data-testid="status-order-created">
      <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-primary" />
      <div><p className="font-semibold text-primary">{order.status === 'free_pickup' ? tr('Pickup request sent', 'تم إرسال طلب الاستلام') : tr('Reservation created', 'تم إنشاء الحجز')}</p>
        <p className="text-sm text-secondary-foreground">{order.status === 'free_pickup' ? tr('Message the seller to agree on a pickup time.', 'راسل البائع للاتفاق على موعد الاستلام.') : tr('Simulate the deposit below to hold your materials.', 'قم بمحاكاة العربون أدناه لتثبيت حجزك.')}</p></div>
    </div>}
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[13px] text-muted-foreground">{tr('Order placed', 'تاريخ الطلب')} {date(order.createdAt)}</p>
          <Link href={`/listing/${order.listingId}`} className="mt-0.5 block text-xl font-bold text-foreground no-underline hover:text-primary">{order.listingTitle}</Link></div>
        <Badge tone={statusTone(order.status)}><span data-testid={`status-order-${order.id}`}>{statusLabel(order.status)}</span></Badge>
      </div>
      <div className="mt-5"><Timeline order={order} /></div>
      <div className="mt-5"><Money order={order} /></div>
      {order.paymentMethod && <p className="mt-3 text-[13px] text-muted-foreground">{tr('Simulated with', 'تمت المحاكاة عبر')} {order.paymentMethod === 'mada' ? tr('Mada', 'مدى') : tr('Card', 'بطاقة')}</p>}
    </Card>

    {role === 'loading' && order.status !== 'completed' && <SkeletonRows rows={1} />}
    {role === 'unknown' && order.status !== 'completed' && <Card className="p-5"><p className="text-sm text-muted-foreground">{tr('The listing for this order could not be loaded, so next steps are unavailable right now.', 'تعذر تحميل إعلان هذا الطلب، لذا الخطوات التالية غير متاحة حالياً.')}</p></Card>}

    {isBuyer && payKind && <Card className="p-5">
      <h2 className="text-base font-semibold">{payKind === 'deposit' ? tr('Pay deposit (simulation)', 'دفع العربون (محاكاة)') : tr('Pay remaining balance (simulation)', 'دفع المتبقي (محاكاة)')}</h2>
      <SimulationNote className="mt-3">{tr('Card and Mada here are demonstrations. No real payment is taken and no card details are collected.', 'البطاقة ومدى هنا للعرض فقط. لن يتم خصم أي مبلغ ولا تُجمع بيانات بطاقة.')}</SimulationNote>
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-semibold">{tr('Payment method', 'طريقة الدفع')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['mada', 'card'] as const).map((m) => <label key={m} className={cx('flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm font-semibold transition-colors', method === m ? 'border-primary bg-secondary text-primary' : 'border-input hover:bg-muted')}>
            <input type="radio" name={`method-${order.id}`} value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-[#075E54]" data-testid={`radio-method-${m}`} />
            <CreditCard size={16} />{m === 'mada' ? tr('Mada', 'مدى') : tr('Card', 'بطاقة')}</label>)}
        </div>
      </fieldset>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
        <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} className="accent-[#075E54]" data-testid="checkbox-simulate-failure" />
        {tr('Simulate a failed payment (to test retry)', 'محاكاة فشل الدفع (لتجربة إعادة المحاولة)')}
      </label>
      <Button size="lg" className="mt-4 w-full" disabled={busy} onClick={() => run(payKind)} testId={payKind === 'deposit' ? `button-pay-deposit-${order.id}` : `button-pay-balance-${order.id}`}>
        {busy ? <><Spinner />{tr('Processing simulation…', 'جارٍ المحاكاة…')}</> : payKind === 'deposit' ? `${tr('Simulate deposit', 'محاكاة دفع العربون')} · ${money(order.depositDue)}` : `${tr('Simulate balance', 'محاكاة دفع المتبقي')} · ${money(order.balanceDue)}`}
      </Button>
    </Card>}

    {isBuyer && order.status === 'awaiting_pickup' && <Card className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Truck size={18} className="text-primary" />{tr('Next: pick up your materials', 'التالي: استلم موادك')}</h2>
      <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm leading-6 text-foreground/85">
        <li>{tr('Message the seller to agree on a time.', 'راسل البائع للاتفاق على موعد.')}</li>
        <li>{tr('Check the materials when you collect them.', 'افحص المواد عند استلامها.')}</li>
        <li>{tr('Confirm pickup here, then settle the balance.', 'أكّد الاستلام هنا ثم سدّد المتبقي.')}</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run('confirm')} testId={`button-confirm-pickup-${order.id}`}>{busy ? <Spinner /> : <PackageCheck size={16} />}{tr('Confirm pickup', 'تأكيد الاستلام')}</Button>
        <Button variant="outline" onClick={messageSeller} disabled={conversation.isPending} testId="button-order-message">{conversation.isPending ? <Spinner /> : <MessageCircle size={16} />}{tr('Message seller', 'راسل البائع')}</Button>
      </div>
    </Card>}

    {isBuyer && order.status === 'free_pickup' && <Card className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Truck size={18} className="text-primary" />{tr('Arrange your free pickup', 'رتّب الاستلام المجاني')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('No payment is needed. Agree on a pickup time with the seller and bring suitable transport.', 'لا حاجة للدفع. اتفق مع البائع على موعد الاستلام وأحضر وسيلة نقل مناسبة.')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run('confirm')} testId={`button-confirm-pickup-${order.id}`}>{busy ? <Spinner /> : <PackageCheck size={16} />}{tr('Confirm pickup', 'تأكيد الاستلام')}</Button>
        <Button variant="outline" onClick={messageSeller} disabled={conversation.isPending} testId="button-order-message">{conversation.isPending ? <Spinner /> : <MessageCircle size={16} />}{tr('Message seller', 'راسل البائع')}</Button>
      </div>
    </Card>}

    {role === 'seller' && order.status !== 'completed' && <Card className="p-5">
      <p className="text-sm leading-6 text-muted-foreground">{order.total === 0
        ? tr('You are giving away this material. Arrange pickup in Messages; the buyer confirms collection. No payment is needed.', 'أنت تتبرع بهذه المادة. رتّب الاستلام عبر الرسائل، ويؤكد المشتري الاستلام. لا حاجة للدفع.')
        : tr('You are the seller for this order. The buyer completes the deposit, pickup confirmation and balance steps. Sale proceeds appear in your Wallet.', 'أنت البائع في هذا الطلب. يكمل المشتري خطوات العربون وتأكيد الاستلام والمتبقي. تظهر عوائد البيع في محفظتك.')}</p>
      {order.total > 0 && <Link href="/wallet" className={cx(btn('outline'), 'mt-3')}>{tr('Open wallet', 'افتح المحفظة')}</Link>}
    </Card>}

    {message && <p role={message.tone === 'err' ? 'alert' : 'status'} className={cx('pop rounded-xl p-3 text-sm font-medium', message.tone === 'ok' ? 'bg-[#e4f3ea] text-success' : 'bg-[#fdecea] text-destructive')} data-testid={message.tone === 'err' ? `status-payment-error-${order.id}` : 'status-payment-success'}>{message.text}</p>}
    {conversation.isError && <p role="alert" className="text-sm text-destructive">{tr('Could not open the conversation.', 'تعذر فتح المحادثة.')}</p>}
    {order.status === 'completed' && <Card className="p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="font-semibold">{tr('Order complete', 'اكتمل الطلب')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tr('Thank you for keeping good materials in use.', 'شكراً لإبقاء المواد الجيدة قيد الاستخدام.')}</p>
          <Link href="/" className={cx(btn('outline'), 'mt-3')} data-testid="link-completed-browse">{tr('Browse more materials', 'تصفح مواد أخرى')}</Link>
        </div>
      </div>
    </Card>}
  </div>;
}
