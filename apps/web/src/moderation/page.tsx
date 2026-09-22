import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';
import './styles.css';
const item = z.object({ id: z.number(), title: z.string(), hidden: z.boolean() });
const schema = z.object({ viewerId: z.string(), ideas: z.array(item), activities: z.array(item.extend({ type: z.enum(['PROJECT', 'EVENT']) })),
  users: z.array(z.object({ id: z.string(), name: z.string(), role: z.enum(['MEMBER', 'OPS']), blocked: z.boolean(), blockReason: z.string() })),
  history: z.array(z.object({ id: z.number(), targetType: z.enum(['IDEA', 'ACTIVITY', 'USER']), targetId: z.string(), action: z.enum(['HIDE', 'RESTORE', 'BLOCK', 'UNBLOCK']), reason: z.string(), actorName: z.string().nullable(), createdAt: z.string() })),
});
const copy = {
  de: { title: 'Moderation', intro: 'Inhalte ausblenden oder Änderungen sperren. Daten und Verantwortung bleiben erhalten. Klärung und Rückfragen laufen über Discord.', ideas: 'Ideen', activities: 'Aktivitäten', users: 'Members', reason: 'Begründung', confirm: 'Bestätigen', cancel: 'Abbrechen', hide: 'Ausblenden', restore: 'Wiederherstellen', block: 'Änderungen sperren', unblock: 'Sperre aufheben', hidden: 'Ausgeblendet', visible: 'Sichtbar', blocked: 'Gesperrt', enabled: 'Änderungen erlaubt', self: 'Deinen eigenen Account kannst du hier nicht sperren.', hideHint: 'Der Inhalt verschwindet für Visitors und Members, einschließlich zugehöriger Aufgaben. Ops behalten Zugriff.', blockHint: 'Bereits offene Sitzungen dürfen keine Änderungen mehr speichern. Aufgaben und Ownership bleiben bestehen.', restoreHint: 'Diese Einschränkung wird aufgehoben. Die Begründung bleibt im Verlauf.', history: 'Moderationsverlauf', latest: 'Die letzten 100 Aktionen.', empty: 'Keine Einträge.', loading: 'Moderation wird geladen …', saving: 'Wird gespeichert …', error: 'Die Moderation konnte nicht geladen werden.', writeError: 'Die Änderung konnte nicht bestätigt werden. Prüfe deine Rechte und lade die Liste neu.', retry: 'Neu laden', denied: 'Dieser Bereich ist nur für Ops zugänglich.', login: 'Anmelden', back: 'Ops-Team', deleted: 'Gelöschter Account', HIDE: 'Ausgeblendet', RESTORE: 'Wiederhergestellt', BLOCK: 'Gesperrt', UNBLOCK: 'Sperre aufgehoben', IDEA: 'Idee', ACTIVITY: 'Aktivität', USER: 'Member' },
  en: { title: 'Moderation', intro: 'Hide content or block changes. Data and responsibility stay intact. Questions and resolutions go through Discord.', ideas: 'Ideas', activities: 'Activities', users: 'Members', reason: 'Reason', confirm: 'Confirm', cancel: 'Cancel', hide: 'Hide', restore: 'Restore', block: 'Block changes', unblock: 'Unblock changes', hidden: 'Hidden', visible: 'Visible', blocked: 'Blocked', enabled: 'Changes allowed', self: 'You cannot block your own account here.', hideHint: 'Visitors and Members lose access to this content, including its tasks. Ops retain access.', blockHint: 'Existing sessions can no longer save changes. Tasks and ownership remain assigned.', restoreHint: 'This restriction will be lifted. Its reason stays in the history.', history: 'Moderation history', latest: 'The latest 100 actions.', empty: 'No entries.', loading: 'Loading moderation …', saving: 'Saving …', error: 'Could not load moderation.', writeError: 'Could not confirm the change. Check your permissions and reload the list.', retry: 'Reload', denied: 'This area is only available to Ops.', login: 'Sign in', back: 'Ops team', deleted: 'Deleted account', HIDE: 'Hidden', RESTORE: 'Restored', BLOCK: 'Blocked', UNBLOCK: 'Unblocked', IDEA: 'Idea', ACTIVITY: 'Activity', USER: 'Member' },
};
function ModerationEntry({ id, title, restricted, kind, language, done, self = false, blockReason }: { id: string; title: string; restricted: boolean; kind: 'ideas' | 'activities' | 'users'; language: Language; done: () => void; self?: boolean; blockReason?: string }) {
  const t = copy[language]; const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const label = useId(); const user = kind === 'users';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const reason = new FormData(event.currentTarget).get('reason'); setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/ops/moderation/${kind}/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [user ? 'blocked' : 'hidden']: !restricted, reason }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) { setError(true); return; } done();
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <article className="moderation-entry" aria-label={title}><h2>{title}</h2><p className="moderation-status">{restricted ? user ? t.blocked : t.hidden : user ? t.enabled : t.visible}</p>
    {blockReason && <p className="moderation-reason">{blockReason}</p>}
    {self ? <p>{t.self}</p> : open ? <form className="account-form idea-form" onSubmit={submit} aria-busy={busy}>
      <p>{restricted ? t.restoreHint : user ? t.blockHint : t.hideHint}</p>
      <label><span id={label}>{t.reason}</span><textarea aria-labelledby={label} name="reason" required maxLength={1000} rows={3} /></label>
      {error && <p role="alert">{t.writeError} <button type="button" className="text-link" onClick={done}>{t.retry}</button></p>}
      <div className="account-actions"><button className="button-primary" disabled={busy}>{busy ? t.saving : t.confirm}</button><button type="button" className="text-link" disabled={busy} onClick={() => setOpen(false)}>{t.cancel}</button></div>
    </form> : <button className="text-link" onClick={() => setOpen(true)}>{restricted ? user ? t.unblock : t.restore : user ? t.block : t.hide}</button>}
  </article>;
}
export function ModerationPage({ language }: { language: Language }) {
  const t = copy[language]; const resource = useResource('/api/ops/moderation', schema); const data = resource.data;
  const [section, setSection] = useState<'ideas' | 'activities' | 'users'>('ideas');
  const rows = data ? section === 'users' ? data.users.map(u => ({ id: u.id, title: u.name, restricted: u.blocked, blockReason: u.blockReason, self: u.id === data.viewerId })) : data[section].map(i => ({ id: String(i.id), title: i.title, restricted: i.hidden })) : [];
  const date = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return <section className="moderation-page"><Link className="text-link" to="/ops">{t.back}</Link><h1>{t.title}</h1><p className="moderation-intro">{t.intro}</p>
    {resource.loading ? <p role="status">{t.loading}</p> : !data ? <div><p role="alert">{[401, 403].includes(resource.status) ? t.denied : t.error}</p>{[401, 403].includes(resource.status) ? <Link className="text-link" to="/login">{t.login}</Link> : <button className="text-link" onClick={resource.retry}>{t.retry}</button>}</div> : <>
      <div className="moderation-sections" role="group" aria-label={t.title}>{(['ideas', 'activities', 'users'] as const).map(key => <button key={key} className="text-link" aria-pressed={section === key} onClick={() => setSection(key)}>{t[key]}</button>)}</div>
      {!rows.length && <p>{t.empty}</p>}{rows.map(row => <ModerationEntry key={`${section}-${row.id}`} {...row} kind={section} language={language} done={resource.retry} />)}
      <details className="moderation-history"><summary>{t.history}</summary><section aria-label={t.history}><p>{t.latest}</p><ol>{data.history.map(action => <li key={action.id}><p><strong>{t[action.action]}</strong> · {t[action.targetType]} #{action.targetId}</p><p className="moderation-reason">{action.reason}</p><p className="moderation-status">{action.actorName ?? t.deleted} · <time dateTime={action.createdAt}>{date.format(new Date(action.createdAt))}</time></p></li>)}</ol>{!data.history.length && <p>{t.empty}</p>}</section></details>
    </>}
  </section>;
}
