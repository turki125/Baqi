import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAvailabilityAlertsQueryKey, getListConversationsQueryKey, getListMessagesQueryKey, useListAvailabilityAlerts, useListConversations,
  useListMessages, useMarkConversationRead, useSendMessage, useUpdateAvailabilityAlert,
} from '@workspace/api-client-react';
import type { AvailabilityAlert, AvailabilityCard, Conversation } from '@workspace/api-client-react';
import { ArrowLeft, BellOff, ExternalLink, ImageIcon, MapPin, MessageCircle, RotateCcw, SearchCheck, Send } from 'lucide-react';
import { useLang } from '../lang';
import { BackLink, Button, EmptyState, ErrorState, ListingPhoto, PageTitle, Protected, SkeletonRows, Spinner, UnreadBadge, btn, cx, useMember } from '../ui';
import { REQ, basePath, initials } from '@/lib/baqi';
import { invalidateAlertSurfaces } from '../alerts';

const poll = (ms: number) => ({ refetchInterval: ms, refetchIntervalInBackground: false, refetchOnWindowFocus: true });
const isAlerts = (c?: Conversation) => c?.kind === 'availability';

function Avatar({ convo, size = 'md' }: { convo?: Conversation; size?: 'md' | 'sm' }) {
  const s = size === 'md' ? 'size-11' : 'size-10';
  if (isAlerts(convo)) return <img src={`${basePath}/logo.svg`} alt="" className={cx(s, 'shrink-0 rounded-full border border-border bg-card object-contain p-1')} data-testid="img-baqi-alerts-logo" />;
  return <span className={cx(s, 'grid shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-primary')}>{initials(convo?.participantName)}</span>;
}

function ConversationList({ activeId }: { activeId?: string }) {
  const { tr, date } = useLang();
  const conversations = useListConversations({ query: { queryKey: getListConversationsQueryKey(), ...poll(20_000) }, request: REQ });
  if (conversations.isLoading) return <SkeletonRows rows={4} />;
  if (conversations.isError) return <ErrorState retry={() => void conversations.refetch()} />;
  if (!conversations.data?.length) return <EmptyState icon={<MessageCircle size={22} />} title={tr('No conversations yet', 'لا توجد محادثات بعد')}
    body={tr('Open a listing and choose Message seller to ask about size, condition or pickup.', 'افتح إعلاناً واختر مراسلة البائع للسؤال عن المقاس أو الحالة أو الاستلام.')}
    action={<Link href="/" className={btn('primary')}>{tr('Browse materials', 'تصفح المواد')}</Link>} />;
  return <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
    {conversations.data.map((c) => {
      const unread = c.unreadCount ?? 0;
      return <li key={c.id} className="border-b border-border last:border-b-0">
        <Link href={`/messages/${c.id}`} aria-current={c.id === activeId ? 'page' : undefined} data-testid={`row-conversation-${c.id}`}
          className={cx('flex items-start gap-3 p-4 text-foreground no-underline transition-colors', c.id === activeId ? 'bg-secondary' : 'hover:bg-muted/70', isAlerts(c) && c.id !== activeId && 'bg-secondary/35')}>
          <Avatar convo={c} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2"><p className={cx('truncate', unread ? 'font-bold' : 'font-semibold')}><bdi>{c.participantName}</bdi></p><time className={cx('shrink-0 text-xs', unread ? 'font-semibold text-primary' : 'text-muted-foreground')}>{date(c.updatedAt)}</time></div>
            <p className={cx('truncate text-[13px] font-medium', isAlerts(c) ? 'text-muted-foreground' : 'text-primary')}>{c.listingTitle}</p>
            <div className="mt-0.5 flex items-center gap-2"><p className={cx('min-w-0 flex-1 truncate text-[13px]', unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{c.lastMessage}</p><UnreadBadge count={unread} /></div>
          </div>
        </Link>
      </li>;
    })}
  </ul>;
}

export function MessagesPage() {
  const { tr } = useLang();
  return <Protected><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <PageTitle title={tr('Messages', 'الرسائل')} subtitle={tr('Ask sellers about materials and agree on pickup times.', 'اسأل البائعين عن المواد واتفق على مواعيد الاستلام.')}
      action={<Link href="/account/alerts" className={btn('outline', 'sm')} data-testid="link-messages-manage-alerts"><SearchCheck size={15} />إدارة تنبيهاتي</Link>} />
    <ConversationList />
  </main></Protected>;
}

export function ChatPage() {
  return <Protected><Chat /></Protected>;
}

function Chat() {
  const { id = '' } = useParams<{ id: string }>();
  const { tr, time, date } = useLang();
  const { user } = useMember();
  const qc = useQueryClient();
  const conversations = useListConversations({ query: { queryKey: getListConversationsQueryKey() }, request: REQ });
  const messages = useListMessages(id, { query: { enabled: !!id, queryKey: getListMessagesQueryKey(id), ...poll(5_000) }, request: REQ });
  const send = useSendMessage({ request: REQ });
  const markRead = useMarkConversationRead({ request: REQ });
  const markRef = useRef(markRead.mutate);
  markRef.current = markRead.mutate;
  const [content, setContent] = useState('');
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const messageViewport = useRef<HTMLDivElement>(null);
  const lastEntry = useRef<HTMLDivElement>(null);
  const convo: Conversation | undefined = conversations.data?.find((c) => c.id === id);
  const official = isAlerts(convo);
  const alerts = useListAvailabilityAlerts({ query: { queryKey: getListAvailabilityAlertsQueryKey(), enabled: official, ...poll(15_000) }, request: REQ });
  const count = messages.data?.length ?? 0;
  const lastId = messages.data?.[count - 1]?.id;
  useEffect(() => {
    if (official && messageViewport.current && lastEntry.current) {
      const pane = messageViewport.current;
      // A tall listing card must not push its factual explanation above the viewport on arrival.
      pane.scrollTop += lastEntry.current.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    } else {
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [count, official]);

  // Mark read only after messages are shown; once per newest message.
  const marked = useRef('');
  useEffect(() => {
    if (!id || !lastId || !messages.isSuccess) return;
    const key = `${id}:${lastId}`;
    if (marked.current === key) return;
    marked.current = key;
    markRef.current({ id }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListConversationsQueryKey() }); } });
  }, [id, lastId, messages.isSuccess, qc]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || sending.current || send.isPending || official) return;
    sending.current = true;
    send.mutate({ id, data: { content: text } }, {
      onSuccess: async () => {
        setContent((current) => current.trim() === text ? '' : current);
        await Promise.all([qc.invalidateQueries({ queryKey: getListMessagesQueryKey(id) }), qc.invalidateQueries({ queryKey: getListConversationsQueryKey() })]);
      },
      onSettled: () => { sending.current = false; },
    });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } };
  const showComposer = !!convo && (convo.kind ?? 'listing') === 'listing';

  let lastDay = '';
  return <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
    <div className="lg:hidden"><BackLink href="/messages">{tr('All messages', 'كل الرسائل')}</BackLink></div>
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <aside className="hidden lg:block"><ConversationList activeId={id} /></aside>
      <section className="flex h-[calc(100dvh-236px-env(safe-area-inset-bottom))] min-h-[240px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100dvh-112px)]" aria-label={tr('Conversation', 'المحادثة')}>
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Avatar convo={convo} size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold" data-testid="text-chat-participant"><bdi>{convo?.participantName ?? (conversations.isLoading ? '\u00a0' : tr('Conversation', 'محادثة'))}</bdi></h1>
            {convo && (official
              ? <p className="truncate text-[13px] text-muted-foreground" data-testid="text-chat-subtitle">{convo.listingTitle}</p>
              : <Link href={`/listing/${convo.listingId}`} className="inline-flex max-w-full items-center gap-1 truncate text-[13px] font-medium text-primary" data-testid="link-chat-listing"><span className="truncate">{convo.listingTitle}</span><ExternalLink size={12} className="shrink-0" /></Link>)}
          </div>
          {official && <Link href="/account/alerts" className={cx(btn('outline', 'sm'), 'shrink-0')} data-testid="link-chat-manage-alerts"><SearchCheck size={15} /><span className="hidden sm:inline">إدارة تنبيهاتي</span><span className="sm:hidden">{tr('Manage', 'إدارة')}</span></Link>}
        </header>
        <div ref={messageViewport} className={cx('flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5', official ? 'bg-[linear-gradient(180deg,hsl(var(--secondary)/.55),hsl(var(--background)/.6)_240px)]' : 'bg-background/60')} aria-live="polite">
          {messages.isLoading ? <SkeletonRows rows={3} /> : messages.isError ? <ErrorState retry={() => void messages.refetch()} /> :
            !messages.data?.length ? <p className="py-10 text-center text-sm text-muted-foreground">{official ? tr('Matches for your saved searches will appear here.', 'المطابقات لعمليات البحث المحفوظة بتظهر هنا.') : tr('No messages yet. Say hello and ask about the material.', 'لا توجد رسائل بعد. ابدأ بالتحية واسأل عن المادة.')}</p> :
            messages.data.map((msg, index) => {
              const mine = !official && msg.senderId === user?.id;
              const day = date(msg.createdAt);
              const showDay = day !== lastDay; lastDay = day;
              return <div key={msg.id} ref={index === count - 1 ? lastEntry : undefined} className={msg.availability ? 'rise' : undefined}>
                {showDay && <p className="my-3 text-center text-xs font-medium text-muted-foreground">{day}</p>}
                <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div data-testid={`message-${msg.id}`} className={cx('rounded-2xl px-3.5 py-2.5 shadow-card', msg.availability ? 'w-full max-w-[420px]' : 'max-w-[82%] sm:max-w-[70%]', mine ? 'rounded-ee-md bg-primary text-primary-foreground' : 'rounded-es-md border border-border bg-card')}>
                    {!mine && <p className="mb-0.5 text-xs font-semibold text-primary"><bdi>{msg.senderName}</bdi></p>}
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-6" dir="auto">{msg.content}</p>
                    {msg.availability && <MatchCard card={msg.availability} alerts={alerts.data} alertsLoaded={alerts.isSuccess} />}
                    <time className={cx('mt-1 block text-end text-[11px]', mine ? 'text-white/75' : 'text-muted-foreground')} dateTime={msg.createdAt}>{time(msg.createdAt)}</time>
                  </div>
                </div>
              </div>;
            })}
          <div ref={bottom} />
        </div>
        {showComposer && <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
          <label htmlFor="composer" className="sr-only">{tr('Write a message', 'اكتب رسالة')}</label>
          <textarea id="composer" rows={1} value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKey} maxLength={2000} dir="auto"
            placeholder={tr('Write a message…', 'اكتب رسالة…')} className="field !min-h-11 max-h-32 flex-1 resize-none !py-2.5" data-testid="input-message" />
          <Button type="submit" disabled={!content.trim() || send.isPending} aria-label={tr('Send message', 'أرسل الرسالة')} testId="button-send-message">
            {send.isPending ? <Spinner /> : <Send size={17} className="rtl-flip" />}<span className="hidden sm:inline">{tr('Send', 'إرسال')}</span>
          </Button>
        </form>}
        {official && <p className="border-t border-border px-4 py-3 text-center text-[12.5px] text-muted-foreground" data-testid="note-alerts-readonly">{tr('Automatic notifications from Baqi. Replies are not available here.', 'إشعارات تلقائية من باقي، ولا يمكن الرد عليها هنا.')}</p>}
        {send.isError && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{tr('Message not sent. Try again.', 'لم تُرسل الرسالة. حاول مرة أخرى.')}</p>}
      </section>
    </div>
  </main>;
}

function MatchCard({ card, alerts, alertsLoaded }: { card: AvailabilityCard; alerts?: AvailabilityAlert[]; alertsLoaded: boolean }) {
  const { tr, money, num } = useLang();
  const qc = useQueryClient();
  const update = useUpdateAvailabilityAlert({ request: REQ });
  const [justPaused, setJustPaused] = useState(false);
  const live = alerts?.find((a) => a.id === card.alertId);
  const status: 'active' | 'paused' | 'deleted' = live ? live.status : alertsLoaded ? 'deleted' : card.alertStatus;

  const setStatus = (next: 'active' | 'paused') => {
    if (update.isPending) return;
    qc.setQueryData<AvailabilityAlert[]>(getListAvailabilityAlertsQueryKey(), (old) => old?.map((a) => a.id === card.alertId ? { ...a, status: next } : a));
    update.mutate({ id: card.alertId, data: { status: next } }, {
      onSuccess: () => setJustPaused(next === 'paused'),
      onSettled: () => { void invalidateAlertSurfaces(qc); },
    });
  };

  const body = <>
    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
      <ListingPhoto src={card.photo} alt={card.title} className={cx('transition-transform duration-500', card.available && 'group-hover:scale-[1.03]', !card.available && 'grayscale')} />
      <div className="absolute start-2.5 top-2.5 flex gap-1.5">
        {card.isFree && <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">مجاني</span>}
        {card.visual && <span className="inline-flex items-center gap-1 rounded-md bg-card/95 px-2 py-0.5 text-xs font-semibold shadow-card"><ImageIcon size={12} />{tr('Photo match', 'مطابقة بالصورة')}</span>}
      </div>
      {!card.available && <div className="absolute inset-0 grid place-items-center bg-foreground/45"><span className="rounded-lg bg-card px-3 py-1.5 text-sm font-bold" data-testid={`status-card-unavailable-${card.listingId}`}>الإعلان غير متاح الآن</span></div>}
    </div>
    <div className="space-y-1.5 p-3.5">
      <p className="line-clamp-2 font-semibold leading-snug" dir="auto">{card.title}</p>
      <p className="num">{card.isFree ? <span className="text-lg font-bold text-success">مجاني</span>
        : <><span className="text-lg font-bold">{money(card.unitPrice ?? 0)}</span><span className="text-sm text-muted-foreground"> / <bdi>{card.unit}</bdi></span></>}</p>
      <p className="text-[13px] text-muted-foreground num">{num(card.quantity)} <bdi>{card.unit}</bdi> {tr('available', 'متاح')} · {card.saleMode === 'full_lot' ? tr('Full lot only', 'تُباع الكمية كاملة') : tr('Sold by quantity', 'بيع جزئي حسب الكمية')}</p>
      {card.requestedQuantity !== null && <p className="rounded-lg bg-secondary/70 px-2.5 py-1.5 text-[12.5px] text-secondary-foreground num">
        {tr('You asked for', 'طلبت')} {num(card.requestedQuantity)} <bdi>{card.unit}</bdi>{card.purchaseQuantity !== card.requestedQuantity && <> · {tr('you would take', 'بتستلم')} {num(card.purchaseQuantity)}</>}
        {!card.isFree && <> · {tr('total', 'الإجمالي')} <strong>{money(card.totalPrice)}</strong></>}</p>}
      <div className="flex items-center justify-between gap-2 pt-1 text-[13px]">
        <span className="flex min-w-0 items-center gap-1 text-muted-foreground"><MapPin size={13} className="shrink-0" /><bdi className="truncate">{card.neighborhood}</bdi></span>
        {card.available && <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary" data-testid={`label-view-listing-${card.listingId}`}>عرض الإعلان<ArrowLeft size={14} className="ltr:rotate-180" /></span>}
      </div>
    </div>
  </>;

  return <div className="mt-2.5">
    {card.available
      ? <Link href={`/listing/${card.listingId}`} className="group block overflow-hidden rounded-xl border border-border bg-card text-foreground no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift" data-testid={`card-availability-${card.listingId}`}>{body}</Link>
      : <div className="overflow-hidden rounded-xl border border-dashed border-input bg-card text-foreground" data-testid={`card-availability-${card.listingId}`}>{body}
        <Link href={`/account/alerts?alert=${card.alertId}`} className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-[13px] font-semibold text-primary" data-testid={`link-card-saved-search-${card.alertId}`}><SearchCheck size={14} />{tr('Back to the saved search', 'الرجوع للبحث المحفوظ')}</Link></div>}

    <div className="mt-2 min-h-8 text-[13px]" aria-live="polite">
      {status === 'deleted' ? <span className="text-muted-foreground" data-testid={`status-card-alert-${card.alertId}`}>{tr('This saved search was deleted.', 'هذا البحث المحفوظ محذوف.')}</span>
        : status === 'active' ? <button type="button" onClick={() => setStatus('paused')} disabled={update.isPending} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60" data-testid={`button-pause-alert-${card.alertId}`}>
            {update.isPending ? <Spinner /> : <BellOff size={14} />}إيقاف التنبيه لهذا البحث</button>
        : <span className="pop inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-soft px-2.5 py-1.5 font-medium text-[#5b4211]" data-testid={`status-card-alert-${card.alertId}`}>
            {justPaused ? 'تم إيقاف التنبيه' : tr('Alert paused for this search', 'التنبيه موقوف لهذا البحث')} ·
            <button type="button" onClick={() => setStatus('active')} disabled={update.isPending} className="inline-flex items-center gap-1 font-bold underline underline-offset-2" data-testid={`button-undo-pause-${card.alertId}`}>
              {update.isPending ? <Spinner /> : <RotateCcw size={13} />}{justPaused ? 'تراجع' : tr('Resume', 'استئناف')}</button></span>}
      {update.isError && <span role="alert" className="ms-2 text-destructive">{tr('Not updated. Try again.', 'ما تم التحديث. حاول مرة ثانية.')}</span>}
    </div>
  </div>;
}
