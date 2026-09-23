import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';

const person = z.object({ id: z.string(), name: z.string() });
const schema = z.object({ canPropose: z.boolean(), pending: z.object({ id: z.number(), recipient: person, fromOwner: person, canCancel: z.boolean() }).nullable() });
const invitationSchema = z.object({ invitation: z.object({ title: z.string(), type: z.enum(['EVENT', 'PROJECT']), activityId: z.number(), fromOwner: z.string() }) });
const copy = {
  de: { title: 'Verantwortung übertragen', recipient: 'Schul-E-Mail der Person', propose: 'Einladung senden', hint: 'Die Person erhält einen Link per E-Mail und muss die Übergabe dort bestätigen. Bis dahin bleibst du verantwortlich.', waiting: 'Einladung gesendet', cancel: 'Einladung zurückziehen', to: 'Eingeladen', loading: 'Übergabe wird geladen …', busy: 'Wird gesendet …', error: 'Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.', conflict: 'Für diese Activity gibt es bereits eine offene Einladung.', denied: 'Du kannst diese Übergabe nicht ändern. Prüfe deine Anmeldung.', invalid: 'Diese E-Mail gehört keinem bestätigten Member (oder dir selbst).', retry: 'Neu laden', inviteTitle: 'Verantwortung übernehmen', invitedBy: 'Eingeladen von', accept: 'Verantwortung übernehmen', accepting: 'Wird übernommen …', acceptHint: 'Wenn du annimmst, bist du für diese Activity verantwortlich. Aufgaben und Team bleiben unverändert.', expired: 'Dieser Einladungslink ist nicht mehr gültig. Bitte den bisherigen Owner um eine neue Einladung.', wrongAccount: 'Diese Einladung ist für diesen Account nicht verfügbar. Prüfe den Link oder melde dich mit der eingeladenen E-Mail an.', signIn: 'Mit der eingeladenen E-Mail anmelden', back: 'Zum Lab' },
  en: { title: 'Transfer ownership', recipient: 'Member’s school email', propose: 'Send invitation', hint: 'They will receive an email link and must confirm the transfer there. You remain responsible until then.', waiting: 'Invitation sent', cancel: 'Withdraw invitation', to: 'Invited', loading: 'Loading transfer …', busy: 'Sending …', error: 'Could not send the invitation. Please try again.', conflict: 'This activity already has a pending invitation.', denied: 'You cannot change this transfer. Check your sign-in.', invalid: 'This email does not belong to a verified Member (or it is your own).', retry: 'Reload', inviteTitle: 'Accept ownership', invitedBy: 'Invited by', accept: 'Accept ownership', accepting: 'Accepting …', acceptHint: 'You will become responsible for this activity. Tasks and team membership stay unchanged.', expired: 'This invitation link is no longer valid. Ask the current owner for a new one.', wrongAccount: 'This invitation is not available for this account. Check the link or sign in with the invited email.', signIn: 'Sign in with the invited email', back: 'Back to the Lab' },
};

export function OwnershipPanel({ id, language, refresh }: { id: number; language: Language; refresh: () => void }) {
  const resource = useResource(`/api/activities/${id}/ownership`, schema);
  const t = copy[language];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'conflict' | 'denied' | 'invalid' | null>(null);
  async function save(action: string, body: unknown) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/activities/${id}/ownership${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 409 ? 'conflict' : [401, 403].includes(response.status) ? 'denied' : response.status === 400 ? 'invalid' : 'error'); return; }
      resource.retry(); refresh();
    } catch { setError('error'); } finally { setBusy(false); }
  }
  function propose(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save('', { email: String(new FormData(event.currentTarget).get('email')).trim().toLowerCase() }); }
  const data = resource.data;
  if (!data) return <p role={resource.loading ? 'status' : 'alert'}>{resource.loading ? t.loading : t.error} {!resource.loading && <button className="text-link" onClick={resource.retry}>{t.retry}</button>}</p>;
  if (!data.pending && !data.canPropose) return null;
  return <section className="ownership-panel" aria-label={t.title}>
    <h2>{t.title}</h2>
    {data.pending ? <div className="management-block"><p className="participation-state">{t.waiting}</p><p>{t.to}: <strong>{data.pending.recipient.name}</strong></p><p className="field-hint">{t.hint}</p>
      {data.pending.canCancel && <button className="text-link" disabled={busy} onClick={() => void save('/cancel', { transferId: data.pending!.id })}>{t.cancel}</button>}
    </div> : <form className="account-form management-block" onSubmit={propose} aria-busy={busy}><p className="field-hint">{t.hint}</p><label>{t.recipient}<input type="email" name="email" autoComplete="email" required maxLength={320} placeholder="name@gso.schule.koeln" /></label><button className="button-primary" disabled={busy}>{busy ? t.busy : t.propose}</button></form>}
    {error && <p role="alert" className="form-error">{t[error]} <button className="text-link" onClick={resource.retry}>{t.retry}</button></p>}
  </section>;
}

export function OwnershipInvitationPage({ language }: { language: Language }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const resource = useResource(validToken ? `/api/ownership-invitations/${token}` : null, invitationSchema);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const t = copy[language];
  async function accept() {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/ownership-invitations/${token}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(true); resource.retry(); return; }
      const invitation = resource.data!.invitation;
      navigate(`/${invitation.type === 'EVENT' ? 'events' : 'projects'}/${invitation.activityId}`);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <section className="account-page invitation-page"><div className="account-heading"><p className="eyebrow">GSO engineering lab</p><h1>{t.inviteTitle}</h1><p>{t.acceptHint}</p></div><div className="invitation-card">
    {!validToken || resource.status === 410 ? <p role="alert">{t.expired}</p>
      : resource.status === 401 ? <><p>{t.signIn}</p><Link className="button-primary" to={`/login?next=${encodeURIComponent(`/ownership/accept?token=${token}`)}`}>{t.signIn}</Link></>
      : resource.status === 404 ? <><p role="alert">{t.wrongAccount}</p><Link className="text-link" to={`/login?next=${encodeURIComponent(`/ownership/accept?token=${token}`)}`}>{t.signIn} ↗</Link></>
      : !resource.data ? <p role={resource.loading ? 'status' : 'alert'}>{resource.loading ? t.loading : t.error} {!resource.loading && <button className="text-link" onClick={resource.retry}>{t.retry}</button>}</p>
      : <><p className="eyebrow">{resource.data.invitation.type === 'EVENT' ? 'Event' : 'Project'}</p><h2>{resource.data.invitation.title}</h2><p>{t.invitedBy}: {resource.data.invitation.fromOwner}</p><button className="button-primary" disabled={busy} onClick={() => void accept()}>{busy ? t.accepting : t.accept}</button>{error && <p role="alert" className="form-error">{t.expired}</p>}</>}
    <Link className="text-link" to="/home">← {t.back}</Link>
  </div></section>;
}
