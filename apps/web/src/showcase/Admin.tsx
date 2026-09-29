import { useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { activityCover, eventCover } from '../activity-covers';
import { CoverPicker } from './CoverPicker';
import { Icon } from '../shared/icon';
import { DateField, TimeField } from '../shared/date-time';
import { useResource } from '../shared/use-resource';
import { eventDetailSchema, eventsSchema, ideaDetailSchema, ideasSchema, type Event, type Idea } from './data';

type Language = 'de' | 'en';
const sessionSchema = z.object({ configured: z.boolean(), authenticated: z.boolean() });
const saveSchema = z.object({ id: z.number().int() });
const text = {
  de: { admin: 'Verwalten', login: 'Admin-Zugang', loginHint: 'Melde dich mit dem Admin-Passwort an, um Events und Ideen zu verwalten.', password: 'Passwort', signIn: 'Anmelden', signOut: 'Abmelden',
    setup: 'Admin-Zugang einrichten', setupHint: 'Setze ADMIN_PASSWORD (mindestens 16 Zeichen) und ADMIN_SESSION_SECRET (mindestens 32 Zeichen) für die API. Starte die API danach neu.',
    wrongPassword: 'Das Passwort stimmt nicht.', rate: 'Zu viele Versuche. Bitte in 15 Minuten erneut probieren.', error: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    events: 'Events', ideas: 'Ideen', newEvent: 'Event erstellen', edit: 'Bearbeiten', overview: 'Übersicht',
    noEvents: 'Noch keine Events veröffentlicht.', noIdeas: 'Noch keine Ideen veröffentlicht.', title: 'Titel', description: 'Beschreibung',
    date: 'Datum', endDate: 'Enddatum', start: 'Beginn', end: 'Ende', location: 'Raum',
    category: 'Format', optional: 'Optional', save: 'Veröffentlichen', update: 'Änderungen speichern', saving: 'Wird gespeichert …',
    preview: 'Vorschau', cancel: 'Abbrechen', dateHint: 'Ein Termin ist optional. Wenn du ihn einträgst, gib auch Beginn und Ende an.',
    invalid: 'Bitte prüfe Titel, Beschreibung und Termin. Das Ende muss nach dem Beginn liegen.', session: 'Deine Sitzung ist abgelaufen. Melde dich erneut an.',
    intro: 'Alles an einem Ort veröffentlichen und aktualisieren.', back: 'Zur Website', loading: 'Lädt …', loadError: 'Inhalte konnten nicht geladen werden.', retry: 'Erneut versuchen',
  },
  en: { admin: 'Manage', login: 'Admin access', loginHint: 'Sign in with the admin password to manage events and ideas.', password: 'Password', signIn: 'Sign in', signOut: 'Sign out',
    setup: 'Set up admin access', setupHint: 'Set ADMIN_PASSWORD (at least 16 characters) and ADMIN_SESSION_SECRET (at least 32 characters) for the API, then restart it.',
    wrongPassword: 'That password is incorrect.', rate: 'Too many attempts. Try again in 15 minutes.', error: 'Something went wrong. Please try again.',
    events: 'Events', ideas: 'Ideas', newEvent: 'Create event', edit: 'Edit', overview: 'Overview',
    noEvents: 'No events published yet.', noIdeas: 'No ideas published yet.', title: 'Title', description: 'Description',
    date: 'Date', endDate: 'End date', start: 'Start', end: 'End', location: 'Room',
    category: 'Format', optional: 'Optional', save: 'Publish', update: 'Save changes', saving: 'Saving …',
    preview: 'Preview', cancel: 'Cancel', dateHint: 'The date is optional. If you set one, add both a start and end time.',
    invalid: 'Check the title, description and schedule. The end must follow the start.', session: 'Your session expired. Sign in again.',
    intro: 'Publish and update everything in one place.', back: 'Back to website', loading: 'Loading …', loadError: 'Could not load the content.', retry: 'Try again',
  },
} as const;

function AdminLogin({ language, refresh, configured }: { language: Language; refresh: () => void; configured: boolean }) {
  const t = text[language];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'wrongPassword' | 'rate' | 'error' | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const form = event.currentTarget;
    try {
      const password = String(new FormData(form).get('password') ?? '');
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 429 ? 'rate' : response.status === 401 ? 'wrongPassword' : 'error'); return; }
      form.reset(); refresh();
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <div className="admin-login"><Link to="/" className="admin-back"><Icon name="arrow-left" size={17} />{t.back}</Link><span className="admin-lock"><Icon name="settings" size={25} /></span><h1>{configured ? t.login : t.setup}</h1><p>{configured ? t.loginHint : t.setupHint}</p>{configured && <form onSubmit={submit}><label>{t.password}<input name="password" type="password" autoComplete="current-password" required autoFocus /></label>{error && <p role="alert" className="admin-error">{t[error]}</p>}<button className="admin-primary" disabled={busy}>{busy ? t.loading : t.signIn}</button></form>}</div>;
}

function AdminLoadState({ language, loading, retry }: { language: Language; loading: boolean; retry: () => void }) {
  const t = text[language];
  return <div className="admin-load-state">{loading ? <p role="status">{t.loading}</p> : <><p role="alert">{t.loadError}</p><button type="button" className="admin-secondary" onClick={retry}>{t.retry}</button></>}</div>;
}

function AdminHome({ language }: { language: Language }) {
  const t = text[language];
  const events = useResource('/api/events', eventsSchema);
  const ideas = useResource('/api/ideas', ideasSchema);
  const [error, setError] = useState('');
  async function remove(kind: 'events' | 'ideas', id: number) {
    const title = kind === 'events' ? t.events : t.ideas;
    if (!window.confirm(language === 'de' ? `${title.slice(0, -1)} wirklich entfernen?` : `Remove this ${kind === 'events' ? 'event' : 'idea'}?`)) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Delete failed');
      if (kind === 'events') events.retry(); else ideas.retry();
    } catch { setError(language === 'de' ? 'Konnte nicht entfernt werden. Bitte erneut versuchen.' : 'Could not remove it. Please try again.'); }
  }
  return <>
    <div className="admin-heading"><div><h1>{t.admin}</h1><p>{t.intro}</p></div><Link className="admin-primary" to="/admin/events/new"><Icon name="plus" size={18} />{t.newEvent}</Link></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-lists">
      <section><h2>{t.events}</h2>{events.data ? events.data.events.length ? <ul>{events.data.events.map(event => <li key={event.id}><img src={eventCover(event).src} alt="" width="56" height="56" /><span>{event.title}</span><Link to={`/admin/events/${event.id}/edit`}>{t.edit}<Icon name="arrow-right" size={16} /></Link><button type="button" className="admin-remove" onClick={() => void remove('events', event.id)}>{language === 'de' ? 'Entfernen' : 'Remove'}</button></li>)}</ul> : <p>{t.noEvents}</p> : <AdminLoadState language={language} loading={events.loading} retry={events.retry} />}</section>
      <section><h2>{t.ideas}</h2>{ideas.data ? ideas.data.ideas.length ? <ul>{ideas.data.ideas.map(idea => <li key={idea.id}><img src={activityCover('idea', idea.title).src} alt="" width="56" height="56" /><span>{idea.title}</span><Link to={`/admin/ideas/${idea.id}/edit`}>{t.edit}<Icon name="arrow-right" size={16} /></Link><button type="button" className="admin-remove" onClick={() => void remove('ideas', idea.id)}>{language === 'de' ? 'Entfernen' : 'Remove'}</button></li>)}</ul> : <p>{t.noIdeas}</p> : <AdminLoadState language={language} loading={ideas.loading} retry={ideas.retry} />}</section>
    </div>
  </>;
}

function AdminForm({ language, kind, item }: { language: Language; kind: 'event' | 'idea'; item?: Event | Idea }) {
  const t = text[language];
  const navigate = useNavigate();
  const edit = Boolean(item);
  const [title, setTitle] = useState(item?.title ?? '');
  const event = kind === 'event' && item && 'placeType' in item ? item : undefined;
  const [selectedCover, setSelectedCover] = useState<string | null>(event?.coverUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'invalid' | 'session' | 'error' | null>(null);
  const cover = kind === 'event' ? eventCover({ title, coverUrl: selectedCover }) : activityCover('idea', title);
  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault(); setError(null);
    const values = new FormData(submission.currentTarget);
    const body = kind === 'idea' ? { title: String(values.get('title') ?? '').trim(), description: String(values.get('description') ?? '').trim() } : {
      title: String(values.get('title') ?? '').trim(), description: String(values.get('description') ?? '').trim(),
      plannedDate: values.get('plannedDate') || null, endDate: values.get('endDate') || null,
      startTime: values.get('startTime') || null, endTime: values.get('endTime') || null,
      placeType: 'SCHOOL', generalLocation: String(values.get('generalLocation') ?? '').trim().toUpperCase(), coverUrl: selectedCover ?? cover.src,
      category: values.get('category') || 'OTHER',
    };
    if (!body.title || !body.description || (kind === 'event' && !body.generalLocation) || (kind === 'event' && 'plannedDate' in body && ((body.plannedDate || body.startTime || body.endTime) && !(body.plannedDate && body.startTime && body.endTime) || Boolean(body.startTime && body.endTime && !body.endDate && body.endTime <= body.startTime)))) { setError('invalid'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/${kind === 'event' ? 'events' : 'ideas'}${edit ? `/${item!.id}` : ''}`, {
        method: edit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) { setError(response.status === 401 ? 'session' : response.status === 400 ? 'invalid' : 'error'); return; }
      const saved = saveSchema.parse(await response.json());
      navigate(`/${kind === 'event' ? 'events' : 'ideas'}/${saved.id}`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <div className="admin-editor"><Link to="/admin" className="admin-back"><Icon name="arrow-left" size={17} />{t.overview}</Link><div className="admin-editor-grid"><aside><img src={cover.src} alt="" width="480" height="480" decoding="async" /><p>{t.preview}</p></aside><form onSubmit={submit} aria-busy={busy}><h1>{edit ? t.edit : t.newEvent}</h1><label className="admin-title"><span className="sr-only">{t.title}</span><input name="title" value={title} onChange={change => setTitle(change.target.value)} maxLength={120} required placeholder={t.title} /></label>{kind === 'event' && <><div className="admin-schedule"><div className="admin-schedule-row"><Icon name="calendar" size={19} /><DateField name="plannedDate" label={t.date} language={language} defaultValue={event?.plannedDate ?? ''} /><DateField name="endDate" label={`${t.endDate} · ${t.optional}`} language={language} defaultValue={event?.endDate ?? ''} /></div><div className="admin-schedule-row"><Icon name="clock" size={19} /><TimeField name="startTime" label={t.start} language={language} defaultValue={event?.startTime?.slice(0, 5) ?? ''} /><TimeField name="endTime" label={t.end} language={language} defaultValue={event?.endTime?.slice(0, 5) ?? ''} /></div></div><p className="admin-hint">{t.dateHint}</p><div className="admin-location"><Icon name="pin" size={19} /><label>{t.location}<input name="generalLocation" maxLength={30} defaultValue={event?.generalLocation === 'GSO' ? '' : event?.generalLocation ?? ''} placeholder="C001" required /></label></div><CoverPicker language={language} value={selectedCover} onChange={setSelectedCover} /><label className="admin-category">{t.category}<select name="category" defaultValue={event?.category ?? 'OTHER'}><option value="OTHER">Event</option><option value="WORKSHOP">Workshop</option><option value="TALK">Talk</option><option value="BUILD_NIGHT">Build Night</option><option value="STUDY_SESSION">Study Session</option><option value="HACKATHON">Hackathon</option><option value="SOCIAL">Social</option></select></label></>}<label className="admin-description">{t.description}<textarea name="description" required maxLength={kind === 'event' ? 12000 : 5000} rows={8} defaultValue={item?.description ?? ''} /></label>{error && <p role="alert" className="admin-error">{t[error]}</p>}<div className="admin-form-actions"><button className="admin-primary" disabled={busy}>{busy ? t.saving : edit ? t.update : t.save}</button><Link to="/admin">{t.cancel}</Link></div></form></div></div>;
}

function AdminEdit({ language, kind }: { language: Language; kind: 'event' | 'idea' }) {
  const { id } = useParams();
  const event = useResource(kind === 'event' ? `/api/events/${encodeURIComponent(id ?? '')}` : null, eventDetailSchema);
  const idea = useResource(kind === 'idea' ? `/api/ideas/${encodeURIComponent(id ?? '')}` : null, ideaDetailSchema);
  const item = kind === 'event' ? event.data?.event : idea.data?.idea;
  if (!item) {
    const current = kind === 'event' ? event : idea;
    return <div className="admin-loading"><p role={current.loading ? 'status' : 'alert'}>{current.loading ? text[language].loading : text[language].error}</p>{!current.loading && <button className="admin-secondary" type="button" onClick={current.retry}>{language === 'de' ? 'Erneut versuchen' : 'Try again'}</button>}</div>;
  }
  return <AdminForm key={`${kind}-${item.id}`} kind={kind} language={language} item={item} />;
}

export default function Admin({ language }: { language: Language }) {
  const session = useResource('/api/admin/session', sessionSchema);
  const navigate = useNavigate();
  const t = text[language];
  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    session.retry(); navigate('/admin');
  }
  if (!session.data) return <div className="admin-loading"><AdminLoadState language={language} loading={session.loading} retry={session.retry} /></div>;
  if (!session.data.authenticated) return <AdminLogin language={language} configured={session.data.configured} refresh={session.retry} />;
  return <div className="admin-shell"><div className="admin-topline"><Link to="/admin"><Icon name="settings" size={17} />{t.admin}</Link><button type="button" onClick={() => void logout()}>{t.signOut}</button></div><Routes><Route index element={<AdminHome language={language} />} /><Route path="events/new" element={<AdminForm language={language} kind="event" />} /><Route path="events/:id/edit" element={<AdminEdit language={language} kind="event" />} /><Route path="ideas/:id/edit" element={<AdminEdit language={language} kind="idea" />} /></Routes></div>;
}
