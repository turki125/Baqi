import { useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAlertEmailStatusQueryKey, getGetAvailabilityUnsubscribeQueryKey, getListAvailabilityAlertsQueryKey,
  useDeleteAvailabilityAlert, useGetAlertEmailStatus, useGetAvailabilityUnsubscribe, useListAvailabilityAlerts,
  useUnsubscribeAvailabilityEmail, useUpdateAvailabilityAlert,
} from '@workspace/api-client-react';
import type { AvailabilityAlert } from '@workspace/api-client-react';
import { Check, Mail, MailX, MessageCircle, Pause, Play, Search, SearchCheck, Trash2 } from 'lucide-react';
import { useLang } from '../lang';
import { BackLink, Button, Card, EmptyState, ErrorState, Modal, PageTitle, Protected, SkeletonRows, Spinner, btn, cx } from '../ui';
import { REQ } from '@/lib/baqi';
import {
  AlertEditor, AlertStatusBadge, CriteriaChips, EmailStatusLine, alertTitle, invalidateAlertSurfaces, useRestoreAlertIntent, type AlertDraft,
} from '../alerts';

export function AlertsPage() {
  const { tr } = useLang();
  return <Protected reason={tr('Sign in to manage the searches you asked Baqi to watch.', 'سجّل الدخول لإدارة عمليات البحث اللي طلبت من باقي يتابعها.')}><AlertsView /></Protected>;
}

function AlertsView() {
  const { tr } = useLang();
  const search = useSearch();
  const focusId = new URLSearchParams(search).get('alert');
  const alerts = useListAvailabilityAlerts({ query: { queryKey: getListAvailabilityAlertsQueryKey(), refetchInterval: 15_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true }, request: REQ });
  const email = useGetAlertEmailStatus({ query: { queryKey: getGetAlertEmailStatusQueryKey() }, request: REQ });
  const [draft, setDraft] = useState<AlertDraft | null>(null);
  useRestoreAlertIntent('restore', '1', setDraft);

  useEffect(() => {
    if (!focusId || !alerts.data) return;
    document.getElementById(`alert-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, alerts.data]);
  const focusMissing = !!focusId && !!alerts.data && !alerts.data.some((a) => a.id === focusId);
  const active = alerts.data?.filter((a) => a.status === 'active').length ?? 0;

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <BackLink href="/account">{tr('Account', 'الحساب')}</BackLink>
    <PageTitle title="إدارة تنبيهاتي" subtitle={tr('Searches Baqi keeps watching for you. Matches arrive in Messages under Baqi Alerts.', 'عمليات البحث اللي يتابعها باقي لك. المطابقات توصلك في الرسائل باسم «تنبيهات باقي».')}
      action={<Link href="/messages" className={btn('outline')} data-testid="link-alerts-messages"><MessageCircle size={16} />{tr('Open Messages', 'افتح الرسائل')}</Link>} />

    <Card className="mb-5 flex items-start gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Mail size={18} /></span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-6">
        <p className="font-semibold">{tr('Email copies', 'نسخ البريد')}</p>
        <div className="text-muted-foreground">{email.isLoading ? <span className="shimmer inline-block h-3 w-48 rounded" /> : email.data ? <EmailStatusLine status={email.data} /> :
          <span>{tr('Email status unavailable.', 'حالة البريد غير متاحة.')} <button type="button" className="font-semibold text-primary underline" onClick={() => void email.refetch()} data-testid="button-email-status-retry">{tr('Retry', 'أعد المحاولة')}</button></span>}</div>
      </div>
    </Card>

    {focusMissing && <p className="mb-4 rounded-xl border border-dashed border-input bg-card p-3 text-[13px] text-muted-foreground" data-testid="note-alert-missing">{tr('That saved search was deleted. Earlier messages stay in your inbox.', 'هذا البحث المحفوظ انحذف. الرسائل السابقة باقية في صندوقك.')}</p>}

    {alerts.isLoading ? <SkeletonRows rows={3} /> : alerts.isError ? <ErrorState retry={() => void alerts.refetch()} /> :
      !alerts.data?.length ? <EmptyState icon={<SearchCheck size={22} />} title={tr('No saved searches yet', 'ما عندك بحث محفوظ')}
        body={tr('Search for a material. If nothing fits, tap “Notify me when available” and we will watch for it.', 'ابحث عن مادة، وإذا ما لقيت شي يناسب اضغط «نبّهني إذا توفّر» ونتابعها لك.')}
        action={<Link href="/" className={btn('primary')} data-testid="link-alerts-browse"><Search size={16} />{tr('Search materials', 'ابحث عن مواد')}</Link>} /> :
      <>
        <p className="mb-3 text-[13px] font-semibold text-muted-foreground num" data-testid="text-alerts-count">{tr(`${active} active of ${alerts.data.length}`, `${active} نشط من ${alerts.data.length}`)}</p>
        <ul className="space-y-3">{alerts.data.map((a, i) => <li key={a.id} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}><AlertRow alert={a} focused={a.id === focusId} /></li>)}</ul>
      </>}
    <AlertEditor draft={draft} onClose={() => setDraft(null)} returnTo="/account/alerts?restore=1" />
  </main>;
}

function AlertRow({ alert, focused }: { alert: AvailabilityAlert; focused: boolean }) {
  const { tr, date, num } = useLang();
  const qc = useQueryClient();
  const update = useUpdateAvailabilityAlert({ request: REQ });
  const del = useDeleteAvailabilityAlert({ request: REQ });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<'status' | 'email' | null>(null);
  const paused = alert.status === 'paused';

  const patch = (data: { status?: 'active' | 'paused'; emailEnabled?: boolean }, kind: 'status' | 'email') => {
    if (update.isPending) return;
    setBusy(kind);
    qc.setQueryData<AvailabilityAlert[]>(getListAvailabilityAlertsQueryKey(), (old) => old?.map((x) => x.id === alert.id ? { ...x, ...data } : x));
    update.mutate({ id: alert.id, data }, { onSettled: () => { setBusy(null); void invalidateAlertSurfaces(qc); } });
  };
  const remove = () => del.mutate({ id: alert.id }, { onSuccess: () => { setConfirm(false); void invalidateAlertSurfaces(qc); } });

  return <Card className={cx('scroll-mt-24 p-4 transition-shadow sm:p-5', focused && 'ring-2 ring-primary/50', paused && 'bg-card/70')}>
    <div id={`alert-${alert.id}`} data-testid={`card-alert-${alert.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className={cx('truncate text-[17px] font-bold', paused && 'text-muted-foreground')} dir="auto">{alertTitle(alert.criteria, tr)}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground num">{tr('Saved', 'حُفظ')} {date(alert.createdAt)} · {tr(`${num(alert.matchCount)} matches`, `${num(alert.matchCount)} مطابقة`)}</p>
        </div>
        <AlertStatusBadge status={alert.status} />
      </div>
      <div className="mt-3"><CriteriaChips criteria={alert.criteria} testPrefix={`chip-alert-${alert.id}`} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <button type="button" role="switch" aria-checked={alert.emailEnabled} onClick={() => patch({ emailEnabled: !alert.emailEnabled }, 'email')} disabled={busy !== null}
          className="inline-flex min-h-10 items-center gap-2.5 rounded-lg text-[13px] font-semibold disabled:opacity-60" data-testid={`switch-alert-email-${alert.id}`}>
          <span className={cx('flex h-6 w-10 rounded-full p-0.5 transition-colors', alert.emailEnabled ? 'justify-end bg-primary' : 'justify-start bg-input')}>
            <span className="pop size-5 rounded-full bg-card shadow-card" key={String(alert.emailEnabled)} /></span>
          {busy === 'email' ? <Spinner /> : alert.emailEnabled ? <Mail size={15} /> : <MailX size={15} className="text-muted-foreground" />}
          {tr('Email for this search', 'البريد لهذا البحث')}
        </button>
        <div className="flex gap-2">
          {alert.matchCount > 0 && <Link href="/messages" className={btn('ghost', 'sm')} data-testid={`link-alert-matches-${alert.id}`}><MessageCircle size={14} />{tr('Matches', 'المطابقات')}</Link>}
          <Button size="sm" variant={paused ? 'primary' : 'outline'} onClick={() => patch({ status: paused ? 'active' : 'paused' }, 'status')} disabled={busy !== null} testId={`button-alert-${paused ? 'resume' : 'pause'}-${alert.id}`}>
            {busy === 'status' ? <Spinner /> : paused ? <Play size={14} /> : <Pause size={14} />}{paused ? tr('Resume', 'استئناف') : tr('Pause', 'إيقاف')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} aria-label={tr('Delete alert', 'حذف التنبيه')} testId={`button-alert-delete-${alert.id}`}><Trash2 size={14} /></Button>
        </div>
      </div>
      {update.isError && <p role="alert" className="mt-2 text-[12.5px] font-medium text-destructive">{tr('Change not saved. Try again.', 'ما انحفظ التغيير. حاول مرة ثانية.')}</p>}
    </div>
    <Modal open={confirm} onOpenChange={setConfirm} title={tr('Delete this saved search?', 'تحذف هذا البحث المحفوظ؟')}>
      <p className="text-sm leading-6 text-muted-foreground">{tr('No new matches will be sent. Cards already in Messages stay readable.', 'ما بنرسل مطابقات جديدة. البطاقات اللي وصلتك في الرسائل تبقى موجودة.')}</p>
      {del.isError && <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">{tr('Could not delete. Try again.', 'تعذر الحذف. حاول مرة ثانية.')}</p>}
      <div className="mt-5 flex gap-2"><Button variant="danger" className="flex-1" onClick={remove} disabled={del.isPending} testId="button-confirm-delete-alert">{del.isPending ? <Spinner /> : <Trash2 size={15} />}{tr('Delete', 'حذف')}</Button>
        <Button variant="outline" onClick={() => setConfirm(false)} testId="button-cancel-delete-alert">{tr('Keep', 'إبقاء')}</Button></div>
    </Modal>
  </Card>;
}

export function EmailUnsubscribePage() {
  const { tr } = useLang();
  const token = new URLSearchParams(useSearch()).get('token') ?? '';
  const valid = token.length >= 32 && token.length <= 128;
  const status = useGetAvailabilityUnsubscribe({ token }, { query: { queryKey: getGetAvailabilityUnsubscribeQueryKey({ token }), enabled: valid, retry: false }, request: REQ });
  const unsub = useUnsubscribeAvailabilityEmail({ request: REQ });
  const done = unsub.isSuccess || status.data?.emailEnabled === false;

  return <main className="mx-auto max-w-md px-4 py-14">
    <Card className="rise p-6 text-center sm:p-8">
      {!valid || status.isError ? <div data-testid="status-unsubscribe-invalid">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[#fdecea] text-destructive"><MailX size={22} /></div>
        <h1 className="text-xl font-bold">{tr('This link is not valid', 'هذا الرابط غير صالح')}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('It may be incomplete or expired. You can manage email for each search from your alerts.', 'ممكن يكون ناقص أو منتهي. تقدر تدير البريد لكل بحث من تنبيهاتك.')}</p>
        <div className="mt-5 flex justify-center gap-2">{valid && <Button variant="outline" onClick={() => void status.refetch()} testId="button-unsubscribe-retry">{tr('Try again', 'أعد المحاولة')}</Button>}
          <Link href="/account/alerts" className={btn('primary')} data-testid="link-unsubscribe-manage">إدارة تنبيهاتي</Link></div>
      </div> : status.isLoading ? <div className="space-y-3"><div className="shimmer mx-auto size-12 rounded-xl" /><div className="shimmer mx-auto h-5 w-2/3 rounded" /><div className="shimmer mx-auto h-4 w-full rounded" /></div>
      : done ? <div data-testid="status-unsubscribe-done">
        <div className="pop mx-auto mb-4 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={22} /></div>
        <h1 className="text-xl font-bold">{tr('Email stopped for this alert', 'أوقفنا البريد لهذا التنبيه')}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('You will not get emails for this search. Matching listings will still arrive in Messages under Baqi Alerts.', 'ما بتوصلك رسائل بريد لهذا البحث، لكن الإعلانات المطابقة بتستمر توصلك في الرسائل باسم «تنبيهات باقي».')}</p>
        <Link href="/account/alerts" className={cx(btn('outline'), 'mt-5')} data-testid="link-unsubscribe-manage">إدارة تنبيهاتي</Link>
      </div> : <div data-testid="panel-unsubscribe-confirm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-secondary text-primary"><Mail size={22} /></div>
        <h1 className="text-xl font-bold">إيقاف رسائل البريد لهذا التنبيه</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('Only email for this one search stops. Its in-app messages and your other searches keep working.', 'يتوقف البريد لهذا البحث فقط. رسائله داخل التطبيق وبقية عمليات البحث تستمر.')}</p>
        {unsub.isError && <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">{tr('Could not update. Try again.', 'تعذر التحديث. حاول مرة ثانية.')}</p>}
        <Button className="mt-5 w-full" onClick={() => unsub.mutate({ data: { token } })} disabled={unsub.isPending} testId="button-confirm-unsubscribe">
          {unsub.isPending ? <Spinner /> : <MailX size={16} />}{tr('Stop email for this alert', 'أوقف البريد لهذا التنبيه')}</Button>
      </div>}
    </Card>
  </main>;
}
