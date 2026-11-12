import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListConversationsQueryKey, getListMessagesQueryKey, useListConversations, useListMessages, useSendMessage,
} from '@workspace/api-client-react';
import type { Conversation } from '@workspace/api-client-react';
import { ExternalLink, MessageCircle, Send } from 'lucide-react';
import { useLang } from '../lang';
import { BackLink, Button, EmptyState, ErrorState, PageTitle, Protected, SkeletonRows, Spinner, btn, cx, useMember } from '../ui';
import { REQ, initials } from '@/lib/baqi';

const poll = (ms: number) => ({ refetchInterval: ms, refetchIntervalInBackground: false, refetchOnWindowFocus: true });

function ConversationList({ activeId }: { activeId?: string }) {
  const { tr, date } = useLang();
  const conversations = useListConversations({ query: { queryKey: getListConversationsQueryKey(), ...poll(20_000) }, request: REQ });
  if (conversations.isLoading) return <SkeletonRows rows={4} />;
  if (conversations.isError) return <ErrorState retry={() => void conversations.refetch()} />;
  if (!conversations.data?.length) return <EmptyState icon={<MessageCircle size={22} />} title={tr('No conversations yet', 'لا توجد محادثات بعد')}
    body={tr('Open a listing and choose Message seller to ask about size, condition or pickup.', 'افتح إعلاناً واختر مراسلة البائع للسؤال عن المقاس أو الحالة أو الاستلام.')}
    action={<Link href="/" className={btn('primary')}>{tr('Browse materials', 'تصفح المواد')}</Link>} />;
  return <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
    {conversations.data.map((c) => <li key={c.id} className="border-b border-border last:border-b-0">
      <Link href={`/messages/${c.id}`} aria-current={c.id === activeId ? 'page' : undefined} data-testid={`row-conversation-${c.id}`}
        className={cx('flex items-start gap-3 p-4 text-foreground no-underline transition-colors', c.id === activeId ? 'bg-secondary' : 'hover:bg-muted/70')}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-primary">{initials(c.participantName)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2"><p className="truncate font-semibold"><bdi>{c.participantName}</bdi></p><time className="shrink-0 text-xs text-muted-foreground">{date(c.updatedAt)}</time></div>
          <p className="truncate text-[13px] font-medium text-primary">{c.listingTitle}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{c.lastMessage}</p>
        </div>
      </Link>
    </li>)}
  </ul>;
}

export function MessagesPage() {
  const { tr } = useLang();
  return <Protected><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <PageTitle title={tr('Messages', 'الرسائل')} subtitle={tr('Ask sellers about materials and agree on pickup times.', 'اسأل البائعين عن المواد واتفق على مواعيد الاستلام.')} />
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
  const [content, setContent] = useState('');
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const convo: Conversation | undefined = conversations.data?.find((c) => c.id === id);
  const count = messages.data?.length ?? 0;
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [count]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || sending.current || send.isPending) return;
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

  let lastDay = '';
  return <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
    <div className="lg:hidden"><BackLink href="/messages">{tr('All messages', 'كل الرسائل')}</BackLink></div>
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <aside className="hidden lg:block"><ConversationList activeId={id} /></aside>
      <section className="flex h-[calc(100dvh-236px-env(safe-area-inset-bottom))] min-h-[240px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100dvh-112px)]" aria-label={tr('Conversation', 'المحادثة')}>
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-primary">{initials(convo?.participantName)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold" data-testid="text-chat-participant"><bdi>{convo?.participantName ?? (conversations.isLoading ? '\u00a0' : tr('Conversation', 'محادثة'))}</bdi></h1>
            {convo && <Link href={`/listing/${convo.listingId}`} className="inline-flex max-w-full items-center gap-1 truncate text-[13px] font-medium text-primary" data-testid="link-chat-listing"><span className="truncate">{convo.listingTitle}</span><ExternalLink size={12} className="shrink-0" /></Link>}
          </div>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto bg-background/60 px-3 py-4 sm:px-5" aria-live="polite">
          {messages.isLoading ? <SkeletonRows rows={3} /> : messages.isError ? <ErrorState retry={() => void messages.refetch()} /> :
            !messages.data?.length ? <p className="py-10 text-center text-sm text-muted-foreground">{tr('No messages yet. Say hello and ask about the material.', 'لا توجد رسائل بعد. ابدأ بالتحية واسأل عن المادة.')}</p> :
            messages.data.map((msg) => {
              const mine = msg.senderId === user?.id;
              const day = date(msg.createdAt);
              const showDay = day !== lastDay; lastDay = day;
              return <div key={msg.id}>
                {showDay && <p className="my-3 text-center text-xs font-medium text-muted-foreground">{day}</p>}
                <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div data-testid={`message-${msg.id}`} className={cx('max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-card sm:max-w-[70%]', mine ? 'rounded-ee-md bg-primary text-primary-foreground' : 'rounded-es-md border border-border bg-card')}>
                    {!mine && <p className="mb-0.5 text-xs font-semibold text-primary"><bdi>{msg.senderName}</bdi></p>}
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-6" dir="auto">{msg.content}</p>
                    <time className={cx('mt-1 block text-end text-[11px]', mine ? 'text-white/75' : 'text-muted-foreground')} dateTime={msg.createdAt}>{time(msg.createdAt)}</time>
                  </div>
                </div>
              </div>;
            })}
          <div ref={bottom} />
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
          <label htmlFor="composer" className="sr-only">{tr('Write a message', 'اكتب رسالة')}</label>
          <textarea id="composer" rows={1} value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKey} maxLength={2000} dir="auto"
            placeholder={tr('Write a message…', 'اكتب رسالة…')} className="field !min-h-11 max-h-32 flex-1 resize-none !py-2.5" data-testid="input-message" />
          <Button type="submit" disabled={!content.trim() || send.isPending} aria-label={tr('Send message', 'أرسل الرسالة')} testId="button-send-message">
            {send.isPending ? <Spinner /> : <Send size={17} className="rtl-flip" />}<span className="hidden sm:inline">{tr('Send', 'إرسال')}</span>
          </Button>
        </form>
        {send.isError && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{tr('Message not sent. Try again.', 'لم تُرسل الرسالة. حاول مرة أخرى.')}</p>}
      </section>
    </div>
  </main>;
}
