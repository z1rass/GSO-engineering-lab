import { TaskPanel } from '../tasks/panel';
import { EventGoing } from './going';
import { RoomPanel } from '../rooms/pages';
import { InterestedControl } from '../interested/control';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';
import { eventCopy } from './copy';

const linkSchema = z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).nullable();
const eventSchema = z.object({ id: z.number(), title: z.string(), description: z.string(), category: z.enum(['TALK','WORKSHOP','BUILD_NIGHT','STUDY_SESSION','HACKATHON','SOCIAL','OTHER']),
  plannedDate: z.string().nullable(), endDate: z.string().nullable(), startTime: z.string().nullable(), endTime: z.string().nullable(), generalLocation: z.string(),
  status: z.enum(['PLANNING','ACTIVE','COMPLETED','CANCELLED']), ideaId: z.number().nullable(), materials: z.string(), repositoryUrl: linkSchema,
  schoolRoomRequired: z.boolean().optional(),
  owner: z.object({ id: z.string(), name: z.string() }).optional(), exactRoom: z.string().optional(), privateInstructions: z.string().optional(), discordUrl: linkSchema.optional(), canEdit: z.boolean().optional(),
});
const detailSchema = z.object({ event: eventSchema });
const listSchema = z.object({ events: z.array(eventSchema) });
const viewerSchema = z.object({ user: z.object({ id: z.string() }) });
const ideasSchema = z.object({ ideas: z.array(z.object({ id: z.number(), title: z.string() })) });
type Event = z.infer<typeof eventSchema>;
function formatDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
function LoadState({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = eventCopy[language];
  return loading ? <p role="status">{t.loading}</p> : status === 404 ? <h1>{t.missing}</h1> : <div><p role="alert">{t.error}</p><button className="text-link" onClick={retry}>{t.retry}</button></div>;
}
export function EventsPage({ language }: { language: Language }) {
  const t = eventCopy[language];
  const resource = useResource('/api/events', listSchema);
  return <section className="ideas-page"><div className="ideas-heading"><div><p className="eyebrow">GSO engineering lab / {t.nav}</p><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><Link className="button-primary" to="/events/new">{t.create} ↗</Link></div>
    {!resource.data ? <LoadState language={language} {...resource} /> : resource.data.events.length ? <ul className="idea-list">{resource.data.events.map(event => <li key={event.id}><Link to={`/events/${event.id}`}><div><span className="status">{t[event.status]}</span><h2>{event.title}</h2><p className="idea-preview">{t[event.category]} · {event.plannedDate ? formatDate(event.plannedDate, language) : t.dateUnknown}</p><p className="field-hint">{event.status === 'ACTIVE' ? t.open : t.tentative}</p></div><span className="idea-arrow" aria-hidden="true">↗</span></Link></li>)}</ul>
    : <div className="ideas-empty project-empty"><h2>{t.empty}</h2><p>{t.emptyBody}</p></div>}
  </section>;
}
export function EventPage({ language }: { language: Language }) {
  const { id } = useParams();
  const t = eventCopy[language];
  const resource = useResource(`/api/events/${encodeURIComponent(id ?? '')}`, detailSchema);
  const event = resource.data?.event;
  return <section className="ideas-page idea-detail"><Link className="text-link" to="/events">← {t.back}</Link>
    {!event ? <LoadState language={language} {...resource} /> : <article className="project-detail"><span className="status">{t[event.status]}</span><h1>{event.title}</h1><p className="eyebrow">{t[event.category]}</p>
      <section className="event-plan" aria-label={t.plan}><p className="event-plan-note">{event.status === 'ACTIVE' ? t.open : t.tentative}</p><dl>
        <div><dt>{t.date}</dt><dd>{event.plannedDate ? formatDate(event.plannedDate, language) : t.dateUnknown}{event.endDate && ` – ${formatDate(event.endDate, language)}`}</dd></div>
        <div><dt>{t.time}</dt><dd>{event.startTime ?? t.startUnknown} – {event.endTime ?? t.endUnknown}<small>{t.timezone}</small></dd></div>
        <div><dt>{t.location}</dt><dd>{event.generalLocation || t.locationUnknown}</dd></div>
      </dl><p className="field-hint">{event.status === 'ACTIVE' ? t.registrationHint : t.preparingHint}</p></section>
      {event.owner && <p className="project-owner">{t.owner}: <strong>{event.owner.name}</strong></p>}
      <p className="idea-description">{event.description}</p>
      <EventGoing key={`going-${event.id}`} id={event.id} language={language} refresh={resource.retry} />
      <InterestedControl key={event.id} target={`/events/${event.id}`} language={language} />
      <div className="project-links">{event.repositoryUrl && <a className="text-link" href={event.repositoryUrl} target="_blank" rel="noopener noreferrer">{t.repositoryUrl} ↗</a>}{event.ideaId && <Link className="text-link" to={`/ideas/${event.ideaId}`}>{t.source} ↗</Link>}</div>
      {event.materials && <section><h2>{t.materials}</h2><p className="idea-description">{event.materials}</p></section>}
      {event.owner ? (event.exactRoom || event.privateInstructions || event.discordUrl) && <section className="project-private"><p className="eyebrow">{t.membersOnly}</p>{event.exactRoom && <p>{t.exactRoom}: {event.exactRoom} · {event.status === 'ACTIVE' ? t.open : t.tentative}</p>}{event.privateInstructions && <><h2>{t.privateInstructions}</h2><p className="idea-description">{event.privateInstructions}</p></>}{event.discordUrl && <a className="text-link" href={event.discordUrl} target="_blank" rel="noopener noreferrer">Discord ↗</a>}</section>
        : <p className="ideas-note">{t.privateLogin} <Link className="text-link" to="/login">{t.signIn} ↗</Link></p>}
      <TaskPanel key={`tasks-${event.id}`} id={event.id} language={language} />
      <RoomPanel key={`room-${event.id}`} id={event.id} language={language} onRequested={resource.retry} />
      {event.canEdit && <div className="account-actions project-actions"><Link className="text-link" to={`/events/${event.id}/edit`}>{t.edit}</Link></div>}
    </article>}
  </section>;
}
function EventForm({ language, event }: { language: Language; event?: Event }) {
  const t = eventCopy[language];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ideas = useResource(event ? null : '/api/ideas', ideasSchema);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'invalid' | 'session' | 'forbidden' | null>(null);
  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault(); setError(null);
    const form = new FormData(submission.currentTarget);
    const body = { title: String(form.get('title')).trim(), description: String(form.get('description')).trim(),
      schoolRoomRequired: form.get('schoolRoomRequired') === 'on', category: form.get('category'), plannedDate: form.get('plannedDate') || null, endDate: form.get('endDate') || null,
      startTime: form.get('startTime') || null, endTime: form.get('endTime') || null, generalLocation: form.get('generalLocation'), exactRoom: form.get('exactRoom'),
      repositoryUrl: form.get('repositoryUrl') || null,
      materials: form.get('materials'), privateInstructions: form.get('privateInstructions'), discordUrl: form.get('discordUrl') || null,
      ...(!event ? { ideaId: form.get('ideaId') ? Number(form.get('ideaId')) : null } : {}),
    };
    if (!body.title || !body.description) { setError('invalid'); return; }
    setBusy(true);
    try {
      const response = await fetch(event ? `/api/events/${event.id}` : '/api/events', { method: event ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 401 ? 'session' : response.status === 403 ? 'forbidden' : response.status === 400 ? 'invalid' : 'error'); return; }
      const id = event?.id ?? detailSchema.parse(await response.json()).event.id;
      navigate(`/events/${id}`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <form className="account-form idea-form" onSubmit={submit} aria-busy={busy}>
    <label>{t.titleField}<input name="title" required maxLength={120} defaultValue={event?.title} /></label>
    <label><span id="event-category-label">{t.category}</span><select name="category" aria-labelledby="event-category-label" defaultValue={event?.category ?? 'OTHER'}>{(['TALK','WORKSHOP','BUILD_NIGHT','STUDY_SESSION','HACKATHON','SOCIAL','OTHER'] as const).map(value => <option key={value} value={value}>{t[value]}</option>)}</select></label>
    <label><span id="event-description-label">{t.description}</span><textarea aria-labelledby="event-description-label" name="description" required maxLength={5000} rows={5} defaultValue={event?.description} /></label>
    <p className="field-hint">{t.publicHint}</p>
    {!event && (ideas.data ? <label><span id="event-idea-label">{t.idea}</span><select name="ideaId" aria-labelledby="event-idea-label" defaultValue={params.get('idea') ?? ''}><option value="">{t.noIdea}</option>{ideas.data.ideas.map(idea => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label> : <LoadState language={language} {...ideas} />)}
    <fieldset className="event-schedule"><legend>{t.plan}</legend><p className="field-hint">{t.planHint}</p>{event && <p className="ideas-note">{t.reschedule}</p>}
      <div className="event-form-grid"><label>{t.plannedDate}<input type="date" name="plannedDate" defaultValue={event?.plannedDate ?? ''} /></label><label>{t.endDate}<input type="date" name="endDate" defaultValue={event?.endDate ?? ''} /></label>
      <label>{t.startTime}<input type="time" name="startTime" defaultValue={event?.startTime ?? ''} /></label><label>{t.endTime}<input type="time" name="endTime" defaultValue={event?.endTime ?? ''} /></label></div>
      <label>{t.generalLocation}<input name="generalLocation" maxLength={300} defaultValue={event?.generalLocation} /></label><p className="field-hint">{t.locationHint}</p>
      <label className="room-agreement"><input type="checkbox" name="schoolRoomRequired" defaultChecked={event?.schoolRoomRequired ?? false} />{t.schoolRoomRequired}</label>
    </fieldset>
    <details className="project-form-section"><summary>{t.resources}</summary><div>
      <label>{t.repositoryUrl}<input type="url" name="repositoryUrl" maxLength={2000} defaultValue={event?.repositoryUrl ?? ''} /></label>
      <label><span id="event-materials-label">{t.materials}</span><textarea aria-labelledby="event-materials-label" name="materials" maxLength={5000} rows={4} defaultValue={event?.materials} /></label>
    </div></details>
    <details className="project-form-section"><summary>{t.membersOnly}</summary><div><p className="field-hint">{t.privateHint}</p>
      <label>{t.exactRoom}<input name="exactRoom" maxLength={300} defaultValue={event?.exactRoom} /></label>
      <label><span id="event-privateInstructions-label">{t.privateInstructions}</span><textarea aria-labelledby="event-privateInstructions-label" name="privateInstructions" maxLength={5000} rows={4} defaultValue={event?.privateInstructions} /></label>
      <label>{t.discordUrl}<input type="url" name="discordUrl" maxLength={2000} defaultValue={event?.discordUrl ?? ''} /></label>
    </div></details>
    {error && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <a className="text-link" href="/login" target="_blank" rel="noopener noreferrer">{t.signIn} ↗</a></>}</p>}
    <div className="account-actions"><button className="button-primary" disabled={busy || (!event && !ideas.data)}>{busy ? t.saving : event ? t.save : t.create}</button><Link className="text-link" to={event ? `/events/${event.id}` : '/events'}>{t.cancel}</Link></div>
  </form>;
}
export function EventEditor({ language, edit = false }: { language: Language; edit?: boolean }) {
  const { id } = useParams();
  const t = eventCopy[language];
  const viewer = useResource('/api/me', viewerSchema);
  const resource = useResource(edit ? `/api/events/${encodeURIComponent(id ?? '')}` : null, detailSchema);
  return <section className="ideas-page idea-editor"><Link className="text-link" to="/events">← {t.back}</Link><div className="account-heading"><h1>{edit ? t.edit : t.newTitle}</h1>{!edit && <p>{t.ownership}</p>}</div>
    {viewer.loading ? <LoadState language={language} {...viewer} /> : viewer.status === 401 ? <p>{t.login} <Link className="text-link" to="/login">{t.signIn} ↗</Link></p>
      : !viewer.data ? <LoadState language={language} {...viewer} /> : edit && !resource.data ? <LoadState language={language} {...resource} />
      : edit && !resource.data?.event.canEdit ? <p role="alert">{t.forbidden}</p>
      : <EventForm key={resource.data?.event.id ?? 'new'} language={language} event={resource.data?.event} />}
  </section>;
}
