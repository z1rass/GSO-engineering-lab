import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';

const copy = {
  de: { title: 'Ops-Team', intro: 'Menschen, die das Lab am Laufen halten.', back: 'Mein Profil', appoint: 'Ops ernennen',
    member: 'Member', select: 'Member auswählen', hint: 'Ops können Seasons verwalten, moderieren und auf das private Club Network zugreifen. Wähle die Person sorgfältig aus.',
    team: 'Aktuelles Team', profiles: 'Profile verwalten', history: 'Rollenverlauf', latest: 'Die letzten 100 Änderungen.', bootstrap: 'Erstes Team', normal: 'Ernannt von', sponsor: 'Bestätigt durch', admin: 'Ausgeführt von',
    loading: 'Team wird geladen …', saving: 'Wird ernannt …', success: 'Neues Ops-Mitglied ernannt.', error: 'Das hat nicht geklappt. Bitte versuche es erneut.',
    conflict: 'Diese Person ist nicht mehr verfügbar oder bereits Ops. Lade das Team erneut.', denied: 'Dieser Bereich ist nur für Ops zugänglich.',
    retry: 'Erneut laden', empty: 'Keine weiteren bestätigten Members.', deleted: 'Gelöschter Account', noChanges: 'Noch keine Änderungen.',
  },
  en: { title: 'Ops team', intro: 'The people who keep the Lab running.', back: 'My profile', appoint: 'Appoint Ops',
    member: 'Member', select: 'Select a Member', hint: 'Ops can manage Seasons, moderate and access the private Club Network. Choose the person carefully.',
    team: 'Current team', profiles: 'Manage profiles', history: 'Role history', latest: 'The latest 100 changes.', bootstrap: 'Initial team', normal: 'Appointed by', sponsor: 'Confirmed by', admin: 'Run by',
    loading: 'Loading team …', saving: 'Appointing …', success: 'New Ops member appointed.', error: 'Something went wrong. Please try again.',
    conflict: 'This person is no longer eligible or is already Ops. Reload the team.', denied: 'This area is only available to Ops.',
    retry: 'Reload', empty: 'No other verified Members.', deleted: 'Deleted account', noChanges: 'No changes yet.',
  },
};
const dashboardSchema = z.object({
  members: z.array(z.object({ id: z.string(), name: z.string(), role: z.enum(['MEMBER', 'OPS']), education: z.string().nullable(), year: z.number().nullable() })),
  changes: z.array(z.object({ id: z.number(), targetName: z.string().nullable(), actorName: z.string().nullable(),
    source: z.enum(['BOOTSTRAP', 'APPOINTMENT']), operator: z.string().nullable(), confirmedBy: z.string().nullable(), createdAt: z.string(),
  })),
});
type Dashboard = z.infer<typeof dashboardSchema>;
export function OpsPage({ language }: { language: Language }) {
  const t = copy[language];
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'anonymous' | 'denied' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | 'conflict' | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/ops', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async response => {
      if (response.status === 401) { setState('anonymous'); return; }
      if (response.status === 403) { setState('denied'); return; }
      if (!response.ok) throw new Error('Ops unavailable');
      setData(dashboardSchema.parse(await response.json())); setState('ready');
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [attempt]);
  async function appoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(null);
    try {
      const response = await fetch('/api/ops/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected }), signal: AbortSignal.timeout(15000) });
      if (response.status === 401) { setState('anonymous'); return; }
      if (response.status === 403) { setState('denied'); return; }
      if (!response.ok) { setFeedback(response.status === 409 ? 'conflict' : 'error'); return; }
      setFeedback('success'); setSelected(''); setAttempt(n => n + 1);
    } catch { setFeedback('error'); } finally { setBusy(false); }
  }
  if (state === 'anonymous') return <Navigate to="/login" replace />;
  const candidates = data?.members.filter(member => member.role === 'MEMBER') ?? [];
  return <section className="ops-page"><Link className="text-link" to="/profile">← {t.back}</Link>
    <div className="account-heading"><p className="eyebrow">GSO engineering lab / Ops</p><h1>{t.title}</h1><p>{t.intro}</p></div>
    {state === 'ready' && <div className="account-actions"><Link className="text-link" to="/ops/rooms">{language === 'de' ? 'Raumanfragen' : 'Room requests'}</Link><Link className="text-link" to="/ops/seasons">{language==='de'?'Seasons verwalten':'Manage seasons'}</Link><Link className="text-link" to="/network">Club Network</Link><Link className="text-link" to="/ops/moderation">Moderation</Link></div>}
    {state === 'loading' ? <p role="status">{t.loading}</p>
      : state === 'denied' ? <p role="alert">{t.denied}</p>
      : state === 'error' ? <div><p role="alert">{t.error}</p><button className="text-link" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button></div>
      : data && <div className="ops-grid"><div>
        <h2>{t.team}</h2><ul className="ops-team" aria-label={t.title}>{data.members.filter(member => member.role === 'OPS').map(member => <li key={member.id}><strong>{member.name}</strong><span className="eyebrow">OPS</span><Link className="text-link" to={`/ops/users/${member.id}/profile-deletion`}>{language === 'de' ? 'Profil entfernen' : 'Remove profile'}</Link></li>)}</ul>
        <form className="account-form ops-appointment" onSubmit={appoint} aria-busy={busy}><h2>{t.appoint}</h2><p className="ops-note" id="ops-permissions">{t.hint}</p>
          {candidates.length ? <><label><span id="ops-member-label">{t.member}</span><select aria-labelledby="ops-member-label" value={selected} onChange={event => { setSelected(event.target.value); setFeedback(null); }} required aria-describedby="ops-permissions">
          <option value="">{t.select}</option>{candidates.map(member => <option key={member.id} value={member.id}>{member.name} · {member.education ?? 'Member'} · {member.id}</option>)}
          </select></label><button className="button-primary" disabled={busy || !selected}>{busy ? t.saving : t.appoint}</button></> : <p>{t.empty}</p>}
          {feedback && <p role={feedback === 'success' ? 'status' : 'alert'} className={feedback === 'success' ? 'form-success' : 'form-error'}>{t[feedback]}</p>}
          {feedback === 'conflict' && <button className="text-link" type="button" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>}
        </form><div className="ops-profile-list"><h2>{t.profiles}</h2>{data.members.filter(member => member.role === 'MEMBER').map(member => <p key={member.id}><span>{member.name}</span><Link className="text-link" to={`/ops/users/${member.id}/profile-deletion`}>{language === 'de' ? 'Profil entfernen' : 'Remove profile'}</Link></p>)}</div></div>
        <div><h2>{t.history}</h2><p className="ops-note">{t.latest}</p><ol className="ops-history" aria-label={t.history}>{data.changes.map(change => <li key={change.id}>
          <strong>{change.targetName ?? t.deleted} → Ops</strong>
          <p>{change.source === 'BOOTSTRAP' ? `${t.bootstrap} · ${t.admin}: ${change.operator} · ${t.sponsor}: ${change.confirmedBy}` : `${t.normal}: ${change.actorName ?? t.deleted}`}</p>
          <time dateTime={change.createdAt}>{new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(change.createdAt))}</time>
        </li>)}</ol>{!data.changes.length && <p>{t.noChanges}</p>}</div>
      </div>}
  </section>;
}
