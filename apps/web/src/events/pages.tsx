import { ActivitySeasons } from '../seasons/panel';
import { LifecyclePanel } from '../lifecycle/panel';
import { OwnershipPanel } from '../ownership/panel';
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
import { activityCover } from '../activity-covers';
import { Icon } from '../shared/icon';
import { DateField, TimeField } from '../shared/date-time';

const linkSchema = z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).nullable();
const eventSchema = z.object({ id: z.number(), title: z.string(), description: z.string(), category: z.enum(['TALK','WORKSHOP','BUILD_NIGHT','STUDY_SESSION','HACKATHON','SOCIAL','OTHER']),
  plannedDate: z.string().nullable(), endDate: z.string().nullable(), startTime: z.string().nullable(), endTime: z.string().nullable(), generalLocation: z.string(),
  status: z.enum(['PLANNING','ACTIVE','COMPLETED','CANCELLED']), ideaId: z.number().nullable(), materials: z.string(), repositoryUrl: linkSchema,
  schoolRoomRequired: z.boolean().optional(), placeType: z.enum(['SCHOOL','ONLINE','OTHER']),
  owner: z.object({ id: z.string(), name: z.string() }).optional(), exactRoom: z.string().optional(), privateInstructions: z.string().optional(), discordUrl: linkSchema.optional(), canEdit: z.boolean().optional(), canClose: z.boolean().optional(),
});
const detailSchema = z.object({ event: eventSchema });
const listSchema = z.object({ events: z.array(eventSchema) });
const viewerSchema = z.object({ user: z.object({ id: z.string() }) });
type Event = z.infer<typeof eventSchema>;
function formatDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
function LoadState({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = eventCopy[language];
  return loading ? <p className="load-state" role="status">{t.loading}</p> : status === 404 ? <h1>{t.missing}</h1> : <div className="load-state"><p role="alert">{t.error}</p><button className="text-link" onClick={retry}>{t.retry}</button></div>;
}
export function EventsPage({ language }: { language: Language }) {
  const t = eventCopy[language];
  const resource = useResource('/api/events', listSchema);
  const [view,setView]=useSearchParams();
  const past=view.get('view')==='past';
  const setPast=(value:boolean)=>setView(value?{view:'past'}:{});
  const visible=resource.data?.events.filter(item=>['COMPLETED','CANCELLED'].includes(item.status)===past);
  return <section className="ideas-page events-index"><div className="ideas-heading"><div><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><Link className="button-primary" to="/events/new"><Icon name="plus" />{t.create}</Link></div>
    <div className="account-actions archive-tabs"><button className="text-link" aria-pressed={!past} onClick={()=>setPast(false)}>{language==='de'?'Aktuell':'Current'}</button><button className="text-link" aria-pressed={past} onClick={()=>setPast(true)}>{language==='de'?'Vergangene':'Past'}</button></div>
    {!resource.data ? <LoadState language={language} {...resource} /> : visible?.length ? <ul className="event-timeline">{visible.map(event => {
      const date = event.plannedDate ? new Date(`${event.plannedDate}T00:00:00Z`) : null;
      const locale = language === 'de' ? 'de-DE' : 'en-GB';
      return <li className="event-timeline-item" key={event.id}><div className="event-timeline-date">{date ? <><strong>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)}</strong><span>{new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(date)} · {date.getUTCFullYear()}</span></> : <><strong>{language === 'de' ? 'Offen' : 'Open'}</strong><span>{t.dateUnknown}</span></>}</div><span className="event-timeline-line" aria-hidden="true" /><Link className="event-timeline-card" to={`/events/${event.id}`}><div className="event-timeline-content"><p className="event-timeline-overline"><Icon name="clock" size={15} />{event.startTime || (event.category !== 'OTHER' ? t[event.category] : t[event.status])}</p><h2>{event.title}</h2><p className="event-timeline-meta">{event.category !== 'OTHER' && event.startTime && <span>{t[event.category]}</span>}{event.generalLocation && event.placeType !== 'SCHOOL' && <span><Icon name="pin" size={15} />{event.generalLocation}</span>}{event.placeType === 'SCHOOL' && <span><Icon name="pin" size={15} />GSO</span>}</p><span className="event-timeline-state">{t[event.status]}</span></div><img className="event-timeline-cover" src={activityCover('event', event.title).src} alt="" width="160" height="160" loading="lazy" decoding="async" /></Link></li>;
    })}</ul>
    : <div className="ideas-empty project-empty"><Icon name="event" size={28} /><h2>{past?(language==='de'?'Noch keine vergangenen Aktivitäten.':'No past activities yet.'):t.empty}</h2>{!past&&<><p>{t.emptyBody}</p><Link className="button-primary" to="/events/new"><Icon name="plus" />{t.create}</Link></>}</div>}
  </section>;
}
export function EventPage({ language }: { language: Language }) {
  const { id } = useParams();
  const t = eventCopy[language];
  const resource = useResource(`/api/events/${encodeURIComponent(id ?? '')}`, detailSchema);
  const event = resource.data?.event;
  const closed=!!event && ['COMPLETED','CANCELLED'].includes(event.status);
  const showDate=!!event?.plannedDate;
  const showTime=!!(event?.startTime || event?.endTime);
  const showLocation=!!event?.generalLocation && (event?.placeType !== 'SCHOOL' || showDate);
  return <section className="ideas-page idea-detail event-detail-page"><Link className="text-link back-link" to={closed?'/events?view=past':'/events'}><Icon name="arrow-left" />{t.back}</Link>
    {!event ? <LoadState language={language} {...resource} /> : <article className="project-detail event-detail" data-cover-tone={activityCover('event', event.title).tone}>
      <div className="event-detail-ambient" style={{ backgroundImage: `url("${activityCover('event', event.title).src}")` }} aria-hidden="true" />
      <div className="event-detail-stage"><div className="event-detail-title"><div className="detail-topline"><span className="status">{t[event.status]}</span>{event.canEdit&&<Link className="management-link" to={`/events/${event.id}/edit`}>{t.edit}</Link>}</div><h1>{event.title}</h1>{event.category !== 'OTHER' && <p className="event-category">{t[event.category]}</p>}</div>
        <div className="event-detail-visual"><img className="activity-detail-cover" src={activityCover('event', event.title).src} alt="" width="520" height="520" decoding="async" />{event.owner && <p className="project-owner"><Icon name="user" size={16} />{t.owner}: <strong>{event.owner.name}</strong></p>}</div>
        <div className="event-detail-summary">
          <section className="event-plan" aria-label={t.plan}><h2>{t.plan}</h2>{(showDate || showTime || showLocation) && <dl>
            {event.plannedDate && <div><dt><Icon name="calendar" />{t.date}</dt><dd>{formatDate(event.plannedDate, language)}{event.endDate && ` – ${formatDate(event.endDate, language)}`}</dd></div>}
            {showTime && <div><dt><Icon name="clock" />{t.time}</dt><dd>{event.startTime ?? t.startUnknown} – {event.endTime ?? t.endUnknown}<small>{t.timezone}</small></dd></div>}
            {showLocation && <div><dt><Icon name="pin" />{t.location}</dt><dd>{event.generalLocation}</dd></div>}
          </dl>}{!showDate && <p className="event-plan-empty">{t.planOpen}</p>}
          {(closed || event.status === 'ACTIVE' || showDate) && <p className="field-hint">{closed ? (language==='de'?'Diese Activity ist beendet.':'This activity has ended.') : event.status === 'ACTIVE' ? t.registrationHint : t.preparingHint}</p>}</section>
          {(event.status==='ACTIVE'||closed)&&<EventGoing closed={closed} key={`going-${event.id}`} id={event.id} language={language} refresh={resource.retry} />}
          {event.status==='PLANNING'&&<InterestedControl key={event.id} target={`/events/${event.id}`} language={language} />}
        </div></div>
      <div className="event-detail-after"><ActivitySeasons key={`seasons-${event.id}`} id={event.id} language={language}/>
      <section className="detail-section"><h2>{language === 'de' ? 'Über das Event' : 'About this event'}</h2><p className="idea-description">{event.description}</p></section>
      <div className="project-links">{event.repositoryUrl && <a className="text-link" href={event.repositoryUrl} target="_blank" rel="noopener noreferrer">{t.repositoryUrl}</a>}{event.ideaId && <Link className="text-link" to={`/ideas/${event.ideaId}`}>{t.source}</Link>}</div>
      {event.materials && <section className="detail-section"><h2>{t.materials}</h2><p className="idea-description">{event.materials}</p></section>}
      {event.owner ? (event.exactRoom || event.privateInstructions || event.discordUrl) && <section className="project-private"><p className="eyebrow">{t.membersOnly}</p>{event.exactRoom && <p>{t.exactRoom}: {event.exactRoom} · {t.roomConfirmed}</p>}{event.privateInstructions && <><h2>{t.privateInstructions}</h2><p className="idea-description">{event.privateInstructions}</p></>}{event.discordUrl && <a className="text-link" href={event.discordUrl} target="_blank" rel="noopener noreferrer">Discord</a>}</section>
        : <p className="ideas-note">{t.privateLogin} <Link className="text-link" to="/login">{t.signIn}</Link></p>}
      <TaskPanel closed={closed} key={`tasks-${event.id}`} id={event.id} language={language} />
      {event.placeType==='SCHOOL'&&<RoomPanel key={`room-${event.id}`} id={event.id} language={language} scheduleNeeded={!(event.plannedDate&&event.startTime&&event.endTime)} onRequested={resource.retry} />}</div>
    </article>}
  </section>;
}
function EventForm({ language, event }: { language: Language; event?: Event }) {
  const archived=!!event&&['COMPLETED','CANCELLED'].includes(event.status);
  const t = eventCopy[language];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState(event?.title ?? '');
  const [coverTitle, setCoverTitle] = useState(event?.title ?? '');
  const [placeType,setPlaceType]=useState<'SCHOOL'|'ONLINE'|'OTHER'>(event?.placeType??'SCHOOL');
  const [error, setError] = useState<'error' | 'invalid' | 'scheduleIncomplete' | 'scheduleOrder' | 'session' | 'forbidden' | null>(null);
  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault(); setError(null);
    const form = new FormData(submission.currentTarget);
    const body = { title: String(form.get('title') ?? '').trim(), description: String(form.get('description') ?? '').trim(),
      placeType, category: event ? form.get('category') : 'OTHER', plannedDate: form.get('plannedDate') || null, endDate: form.get('endDate') || null,
      startTime: form.get('startTime') || null, endTime: form.get('endTime') || null, generalLocation: placeType==='OTHER' ? form.get('generalLocation') ?? '' : placeType==='ONLINE' ? 'Online' : 'GSO',
      repositoryUrl: form.get('repositoryUrl') || null,
      privateInstructions: form.get('privateInstructions') ?? '', discordUrl: form.get('discordUrl') || null,
      ...(!event ? { ideaId: params.get('idea') ? Number(params.get('idea')) : null } : {}),
    };
    if (!body.title || !body.description) { setError('invalid'); return; }
    if (!event && (body.plannedDate || body.startTime || body.endTime) && !(body.plannedDate && body.startTime && body.endTime)) {
      setError('scheduleIncomplete');
      const missing = !body.plannedDate ? 'plannedDate' : !body.startTime ? 'startTime' : 'endTime';
      submission.currentTarget.querySelector<HTMLButtonElement>(`[data-picker-name="${missing}"]`)?.focus();
      return;
    }
    if (!event && body.startTime && body.endTime && body.endTime <= body.startTime) {
      setError('scheduleOrder');
      submission.currentTarget.querySelector<HTMLButtonElement>('[data-picker-name="endTime"]')?.focus();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(event ? `/api/events/${event.id}` : '/api/events', { method: event ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 401 ? 'session' : response.status === 403 ? 'forbidden' : response.status === 400 ? 'invalid' : 'error'); return; }
      const id = event?.id ?? detailSchema.parse(await response.json()).event.id;
      navigate(`/events/${id}`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <form className={`account-form idea-form creation-form${event ? '' : ' event-create-form'}`} data-cover-tone={!event ? activityCover('event', coverTitle).tone : undefined} onSubmit={submit} aria-busy={busy}>
    {!event && <div className="event-create-art" aria-hidden="true"><img src={activityCover('event', coverTitle).src} alt="" width="600" height="600" decoding="async" /></div>}
    <label className="creation-title-field">{t.titleField}<input name="title" required maxLength={120} value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} onBlur={()=>setCoverTitle(draftTitle)} placeholder={t.titlePlaceholder} /></label>
    {event && <label><span id="event-category-label">{t.category}</span><select name="category" aria-labelledby="event-category-label" defaultValue={event.category}>{(['TALK','WORKSHOP','BUILD_NIGHT','STUDY_SESSION','HACKATHON','SOCIAL','OTHER'] as const).map(value => <option key={value} value={value}>{t[value]}</option>)}</select></label>}
    {!event && <section className="event-create-schedule" aria-labelledby="event-create-schedule-title">
      <div className="event-create-schedule-heading"><h2 id="event-create-schedule-title">{t.createScheduleTitle}</h2><p>{t.createScheduleHint}</p></div>
      <div className="event-create-date-time-grid"><DateField name="plannedDate" label={t.date} language={language} /><TimeField name="startTime" label={t.startTime} language={language} /><TimeField name="endTime" label={t.endTime} language={language} /></div>
      <label>{t.placeType}<select name="placeType" value={placeType} onChange={e=>setPlaceType(e.target.value as 'SCHOOL'|'ONLINE'|'OTHER')}><option value="SCHOOL">{t.schoolPlace}</option><option value="ONLINE">{t.onlinePlace}</option><option value="OTHER">{t.otherPlace}</option></select></label>
      {placeType==='OTHER'&&<label>{t.generalLocation}<input name="generalLocation" maxLength={300} required /></label>}
      <p className="event-create-place-hint">{placeType==='SCHOOL'?t.schoolRequestHint:placeType==='ONLINE'?t.onlineHint:t.locationHint}</p>
      {(error==='scheduleIncomplete'||error==='scheduleOrder')&&<p className="event-create-error" role="alert">{t[error]}</p>}
    </section>}
    <label><span id="event-description-label">{event ? t.description : t.createDescription}</span><textarea aria-labelledby="event-description-label" name="description" required maxLength={12000} rows={event ? 4 : 3} defaultValue={event?.description} placeholder={t.descriptionPlaceholder} /></label>
    <p className="field-hint creation-public-hint">{event ? t.publicHint : t.shortPublicHint}</p>
    {event && <><details className="project-form-section creation-disclosure" open={!!(event.plannedDate || event.endDate || event.startTime || event.endTime || event.placeType !== 'SCHOOL')}>
      <summary><span>{t.plan}</span></summary><div className="creation-disclosure-body event-schedule">
        <p className="field-hint">{t.planHint}</p>{event && <p className="field-hint">{archived?(language==='de'?'Der Termin einer beendeten Activity bleibt erhalten.':'The schedule of a closed activity is preserved.'):t.reschedule}</p>}
        <div className="event-form-grid"><DateField name="plannedDate" label={t.plannedDate} language={language} readOnly={archived} defaultValue={event?.plannedDate ?? ''} /><DateField name="endDate" label={t.endDate} language={language} readOnly={archived} defaultValue={event?.endDate ?? ''} />
          <TimeField name="startTime" label={t.startTime} language={language} readOnly={archived} defaultValue={event?.startTime ?? ''} /><TimeField name="endTime" label={t.endTime} language={language} readOnly={archived} defaultValue={event?.endTime ?? ''} /></div>
        <label>{t.placeType}<select name="placeType" value={placeType} onChange={e=>setPlaceType(e.target.value as 'SCHOOL'|'ONLINE'|'OTHER')}><option value="SCHOOL">{t.schoolPlace}</option><option value="ONLINE">{t.onlinePlace}</option><option value="OTHER">{t.otherPlace}</option></select></label>
        {placeType==='OTHER'&&<label>{t.generalLocation}<input name="generalLocation" maxLength={300} defaultValue={event?.placeType==='OTHER'?event.generalLocation:''} /></label>}
        <p className="field-hint">{placeType==='SCHOOL'?t.schoolRequestHint:placeType==='ONLINE'?t.onlineHint:t.locationHint}</p>
      </div></details>
    <details className="project-form-section creation-disclosure" open={!!event.repositoryUrl}><summary><span>{t.moreDetails}</span></summary><div className="creation-disclosure-body">
      <label>{t.repositoryUrl}<input type="url" name="repositoryUrl" maxLength={2000} defaultValue={event?.repositoryUrl ?? ''} /></label><p className="field-hint">{t.repositoryHint}</p>
    </div></details>
    <details className="project-form-section creation-disclosure" open={!!(event.privateInstructions || event.discordUrl)}><summary><span>{t.membersOnly}</span></summary><div className="creation-disclosure-body"><p className="field-hint">{t.privateHint}</p>
      <label><span id="event-privateInstructions-label">{t.privateInstructions}</span><textarea aria-labelledby="event-privateInstructions-label" name="privateInstructions" maxLength={5000} rows={4} defaultValue={event?.privateInstructions} /></label>
      <label>{t.discordUrl}<input type="url" name="discordUrl" maxLength={2000} defaultValue={event?.discordUrl ?? ''} /></label>
    </div></details></>}
    {error && error !== 'scheduleIncomplete' && error !== 'scheduleOrder' && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <a className="text-link" href="/login" target="_blank" rel="noopener noreferrer">{t.signIn}</a></>}</p>}
    <div className="account-actions"><button className="button-primary" disabled={busy}>{busy ? t.saving : event ? t.save : t.create}</button><Link className="text-link" to={event ? `/events/${event.id}` : '/events'}>{t.cancel}</Link></div>
  </form>;
}
export function EventEditor({ language, edit = false }: { language: Language; edit?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = eventCopy[language];
  const viewer = useResource('/api/me', viewerSchema);
  const resource = useResource(edit ? `/api/events/${encodeURIComponent(id ?? '')}` : null, detailSchema);
  return <section className={`ideas-page idea-editor${edit ? '' : ' event-create-page'}`}><Link className="text-link back-link" to={edit?`/events/${id}`:'/events'}><Icon name="arrow-left" />{edit?(language==='de'?'Zum Event':'Back to event'):t.back}</Link><div className="account-heading"><h1>{edit ? t.edit : t.newTitle}</h1></div>
    {viewer.loading ? <LoadState language={language} {...viewer} /> : viewer.status === 401 ? <div className="creation-signin"><p>{t.login}</p><Link className="button-primary" to={`/login?next=${encodeURIComponent(edit ? `/events/${id}/edit` : `/events/new${location.search}`)}`}>{t.signIn}</Link></div>
      : !viewer.data ? <LoadState language={language} {...viewer} /> : edit && !resource.data ? <LoadState language={language} {...resource} />
      : edit && !resource.data?.event.canEdit ? <p role="alert">{t.forbidden}</p>
      : <><EventForm key={resource.data?.event.id ?? 'new'} language={language} event={resource.data?.event} />{edit&&resource.data?.event&&<div className="management-area"><div className="management-heading"><h2>{language==='de'?'Event verwalten':'Manage event'}</h2><p>{language==='de'?'Teilnahme, Aufgaben, Raum und Verantwortung an einem Ort.':'Registration, tasks, room and responsibility in one place.'}</p></div>
        <EventGoing manage id={resource.data.event.id} language={language} refresh={resource.retry} closed={['COMPLETED','CANCELLED'].includes(resource.data.event.status)}/>
        <TaskPanel manage id={resource.data.event.id} language={language} closed={['COMPLETED','CANCELLED'].includes(resource.data.event.status)}/>
        {resource.data.event.placeType==='SCHOOL'&&<RoomPanel manage id={resource.data.event.id} language={language} scheduleNeeded={!(resource.data.event.plannedDate&&resource.data.event.startTime&&resource.data.event.endTime)} onRequested={resource.retry}/>}
        {resource.data.event.owner&&<OwnershipPanel id={resource.data.event.id} language={language} refresh={resource.retry}/>}
        {resource.data.event.canClose&&<LifecyclePanel id={resource.data.event.id} language={language} refresh={()=>{resource.retry();navigate(`/events/${id}`);}}/>}
      </div>}</>}
  </section>;
}
