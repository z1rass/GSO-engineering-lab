import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { activityCover } from '../activity-covers';
import { LoginPage } from '../auth/pages';
import { Icon } from '../shared/icon';
import { useResource } from '../shared/use-resource';
import { eventDate, eventDetailSchema, eventIsPast, eventsSchema, ideaDate, ideaDetailSchema, ideasSchema, type Event, type Idea } from './data';

const Admin = lazy(() => import('./Admin'));
type Language = 'de' | 'en';

const words = {
  de: { events: 'Events', ideas: 'Ideen', admin: 'Verwalten', intro: 'Ein Ort für Menschen, die Ideen in die Tat umsetzen.',
    discover: 'Events entdecken', browseIdeas: 'Ideen ansehen', next: 'Als Nächstes', allEvents: 'Alle Events', allIdeas: 'Alle Ideen',
    eventIntro: 'Workshops, Talks und Abende zum gemeinsamen Bauen.', ideaIntro: 'Gedanken, aus denen etwas entstehen kann.',
    upcoming: 'Anstehend', past: 'Vergangen', noEvents: 'Noch keine Events.', noIdeas: 'Noch keine Ideen.',
    noEventsBody: 'Sobald ein Event geplant ist, findest du es hier.', noIdeasBody: 'Bald gibt es hier neue Gedanken aus dem Lab.',
    dateOpen: 'Termin folgt', locationOpen: 'Ort folgt', about: 'Über dieses Event', theIdea: 'Die Idee',
    published: 'Veröffentlicht', backEvents: 'Alle Events', backIdeas: 'Alle Ideen', addCalendar: 'Zum Kalender hinzufügen',
    maps: 'Ort in Maps öffnen', relatedIdea: 'Entstanden aus einer Idee', moreEvents: 'Weitere Events', moreIdeas: 'Weitere Ideen',
    planned: 'In Planung', active: 'Geplant', completed: 'Vergangen', cancelled: 'Abgesagt',
    error: 'Inhalte konnten nicht geladen werden.', retry: 'Erneut versuchen', notFound: 'Diese Seite gibt es nicht.',
    tagline: 'Ideen teilen. Zusammen etwas bauen.', aboutLab: 'Ein offenes technisches Community-Lab am GSO Berufskolleg in Köln.',
    readMore: 'Ansehen', today: 'Heute', online: 'Online', schedule: 'Datum & Zeit', location: 'Ort',
  },
  en: { events: 'Events', ideas: 'Ideas', admin: 'Manage', intro: 'A place for people who turn ideas into things.',
    discover: 'Explore events', browseIdeas: 'Browse ideas', next: 'Up next', allEvents: 'All events', allIdeas: 'All ideas',
    eventIntro: 'Workshops, talks and evenings spent building together.', ideaIntro: 'Thoughts that might become something real.',
    upcoming: 'Upcoming', past: 'Past', noEvents: 'No events yet.', noIdeas: 'No ideas yet.',
    noEventsBody: 'The next planned event will appear here.', noIdeasBody: 'Fresh thoughts from the Lab will appear here.',
    dateOpen: 'Date to be announced', locationOpen: 'Location to be announced', about: 'About this event', theIdea: 'The idea',
    published: 'Published', backEvents: 'All events', backIdeas: 'All ideas', addCalendar: 'Add to calendar',
    maps: 'Open location in Maps', relatedIdea: 'Started as an idea', moreEvents: 'More events', moreIdeas: 'More ideas',
    planned: 'In planning', active: 'Scheduled', completed: 'Past', cancelled: 'Cancelled',
    error: 'Could not load the content.', retry: 'Try again', notFound: 'This page does not exist.',
    tagline: 'Share ideas. Build things together.', aboutLab: 'An open technical community lab at GSO Berufskolleg in Cologne.',
    readMore: 'View', today: 'Today', online: 'Online', schedule: 'Date & time', location: 'Location',
  },
} as const;

function LoadState({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = words[language];
  if (loading) return <div className="showcase-load" role="status"><span className="loading-pulse" />{language === 'de' ? 'Lädt …' : 'Loading …'}</div>;
  return <div className="showcase-load"><p role="alert">{status === 404 ? t.notFound : t.error}</p><button type="button" onClick={retry}>{t.retry}</button></div>;
}

function DateTile({ date, language }: { date: string | null; language: Language }) {
  return <span className="date-tile" aria-hidden="true">{date ? <><small>{eventDate(date, language, { month: 'short' })}</small><strong>{eventDate(date, language, { day: '2-digit' })}</strong></> : <Icon name="calendar" size={23} />}</span>;
}

function EventMoment({ event, language }: { event: Event; language: Language }) {
  const t = words[language];
  return <div className="event-moment"><DateTile date={event.plannedDate} language={language} /><div><strong>{event.plannedDate ? eventDate(event.plannedDate, language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : t.dateOpen}</strong>{event.plannedDate && <span>{[event.startTime?.slice(0, 5), event.endTime?.slice(0, 5)].filter(Boolean).join(' – ')}{event.startTime ? ' · Europe/Berlin' : ''}</span>}</div></div>;
}

function EventPlace({ event, language }: { event: Event; language: Language }) {
  const t = words[language];
  const place = event.placeType === 'ONLINE' ? t.online : event.placeType === 'SCHOOL' ? event.status === 'PLANNING' ? language === 'de' ? 'GSO Berufskolleg (angefragt)' : 'GSO Berufskolleg (requested)' : 'GSO Berufskolleg' : event.generalLocation;
  return <div className="event-moment"><span className="place-tile"><Icon name="pin" size={22} /></span><div><strong>{place || t.locationOpen}</strong>{event.placeType === 'SCHOOL' && <span>Köln</span>}</div></div>;
}

function EventCard({ event, language, priority = false }: { event: Event; language: Language; priority?: boolean }) {
  const cover = activityCover('event', event.title);
  return <li className="event-row"><div className="event-row-date" aria-hidden="true">{event.plannedDate ? <><strong>{eventDate(event.plannedDate, language, { day: 'numeric', month: 'short' })}</strong><span>{eventDate(event.plannedDate, language, { weekday: 'long', year: 'numeric' })}</span></> : <><strong>—</strong><span>{words[language].dateOpen}</span></>}</div><span className="event-row-node" aria-hidden="true" /><Link to={`/events/${event.id}`} className="event-row-card"><div className="event-row-copy"><span className="event-row-mobile-date">{event.plannedDate ? eventDate(event.plannedDate, language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : words[language].dateOpen}</span><span className="event-row-time">{event.startTime?.slice(0, 5) ?? words[language].planned}</span><h2>{event.title}</h2><p><Icon name="pin" size={16} />{event.placeType === 'SCHOOL' ? event.status === 'PLANNING' ? language === 'de' ? 'GSO · Raum angefragt' : 'GSO · room requested' : 'GSO Berufskolleg' : event.placeType === 'ONLINE' ? words[language].online : event.generalLocation || words[language].locationOpen}</p></div><img src={cover.src} alt="" width="190" height="190" loading={priority ? 'eager' : 'lazy'} decoding="async" /></Link></li>;
}

function IdeaCard({ idea, language, priority = false }: { idea: Idea; language: Language; priority?: boolean }) {
  const cover = activityCover('idea', idea.title);
  return <li><Link className="idea-card" to={`/ideas/${idea.id}`}><img src={cover.src} alt="" width="400" height="400" loading={priority ? 'eager' : 'lazy'} decoding="async" /><span className="idea-card-copy"><span className="idea-card-date">{ideaDate(idea.createdAt, language)}</span><strong>{idea.title}</strong><span className="idea-card-description">{idea.description}</span></span></Link></li>;
}

function Landing({ language }: { language: Language }) {
  const t = words[language];
  const events = useResource('/api/events', eventsSchema);
  const ideas = useResource('/api/ideas', ideasSchema);
  const featured = events.data?.events.find(event => event.plannedDate && !eventIsPast(event)) ?? null;
  const cover = activityCover('event', featured?.title ?? 'GSO Engineering Lab');
  return <div className="showcase-landing">
    <section className="landing-feature" data-tone={cover.tone}><div className="landing-feature-copy"><span className="landing-identity"><Icon name="spark" size={18} /> GSO Engineering Lab</span><h1>{featured ? featured.title : t.intro}</h1><p>{featured ? featured.description : t.aboutLab}</p><div className="landing-feature-actions"><Link className="solid-action" to={featured ? `/events/${featured.id}` : '/events'}>{featured ? t.readMore : t.discover}<Icon name="arrow-right" size={18} /></Link><Link className="quiet-action" to="/ideas">{t.browseIdeas}</Link></div></div><div className="landing-feature-art"><img src={cover.src} alt="" width="620" height="620" decoding="async" /></div></section>
    <section className="landing-collection"><div className="section-heading"><div><h2>{t.next}</h2><p>{t.eventIntro}</p></div><Link to="/events">{t.allEvents}<Icon name="arrow-right" size={17} /></Link></div>{events.data ? <>{events.data.events.filter(event => !eventIsPast(event)).length ? <ul className="event-timeline landing-events">{events.data.events.filter(event => !eventIsPast(event)).sort((a, b) => (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999')).slice(0, 3).map(event => <EventCard key={event.id} event={event} language={language} priority />)}</ul> : <p className="collection-empty">{t.noEventsBody}</p>}</> : <LoadState language={language} {...events} />}</section>
    <section className="landing-collection landing-ideas"><div className="section-heading"><div><h2>{t.ideas}</h2><p>{t.ideaIntro}</p></div><Link to="/ideas">{t.allIdeas}<Icon name="arrow-right" size={17} /></Link></div>{ideas.data ? ideas.data.ideas.length ? <ul className="idea-grid">{ideas.data.ideas.slice(0, 3).map(idea => <IdeaCard key={idea.id} idea={idea} language={language} priority />)}</ul> : <p className="collection-empty">{t.noIdeasBody}</p> : <LoadState language={language} {...ideas} />}</section>
    <section className="landing-close"><Icon name="spark" size={26} /><h2>{t.tagline}</h2><p>{t.aboutLab}</p><Link to="/events">{t.discover}<Icon name="arrow-right" size={18} /></Link></section>
  </div>;
}

function EventsIndex({ language }: { language: Language }) {
  const t = words[language];
  const data = useResource('/api/events', eventsSchema);
  const [query, setQuery] = useSearchParams();
  const past = query.get('view') === 'past';
  const visible = data.data?.events.filter(event => eventIsPast(event) === past).sort((a, b) => past ? (b.plannedDate ?? '').localeCompare(a.plannedDate ?? '') : (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999'));
  return <div className="collection-page"><div className="collection-head"><div><h1>{t.events}</h1><p>{t.eventIntro}</p></div><div className="segment-tabs" role="group" aria-label={t.events}><button type="button" aria-pressed={!past} onClick={() => setQuery({})}>{t.upcoming}</button><button type="button" aria-pressed={past} onClick={() => setQuery({ view: 'past' })}>{t.past}</button></div></div>{!data.data ? <LoadState language={language} {...data} /> : visible?.length ? <ul className="event-timeline">{visible.map((event, index) => <EventCard key={event.id} event={event} language={language} priority={index < 3} />)}</ul> : <div className="collection-empty"><Icon name="calendar" size={28} /><h2>{t.noEvents}</h2><p>{t.noEventsBody}</p></div>}</div>;
}

function IdeasIndex({ language }: { language: Language }) {
  const t = words[language];
  const data = useResource('/api/ideas', ideasSchema);
  return <div className="collection-page"><div className="collection-head"><div><h1>{t.ideas}</h1><p>{t.ideaIntro}</p></div></div>{!data.data ? <LoadState language={language} {...data} /> : data.data.ideas.length ? <ul className="idea-grid">{data.data.ideas.map((idea, index) => <IdeaCard key={idea.id} idea={idea} language={language} priority={index < 3} />)}</ul> : <div className="collection-empty"><Icon name="idea" size={28} /><h2>{t.noIdeas}</h2><p>{t.noIdeasBody}</p></div>}</div>;
}

function downloadCalendar(event: Event) {
  if (!event.plannedDate) return;
  const date = event.plannedDate.replaceAll('-', '');
  const calendarEnd = event.endTime ? event.endDate ?? event.plannedDate : new Date(Date.parse(`${event.endDate ?? event.plannedDate}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const endDate = calendarEnd.replaceAll('-', '');
  const calendarTime = (value: string) => value.replaceAll(':', '').slice(0, 6).padEnd(6, '0');
  const start = event.startTime ? `${date}T${calendarTime(event.startTime)}` : date;
  const end = event.endTime ? `${endDate}T${calendarTime(event.endTime)}` : endDate;
  const escape = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GSO Engineering Lab//Events//EN', 'BEGIN:VEVENT', `UID:event-${event.id}@gso-engineering-lab`, `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.generalLocation)}`, `DTSTART${event.startTime ? ';TZID=Europe/Berlin' : ';VALUE=DATE'}:${start}`, `DTEND${event.endTime ? ';TZID=Europe/Berlin' : ';VALUE=DATE'}:${end}`, 'END:VEVENT', 'END:VCALENDAR'];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `gso-event-${event.id}.ics`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventDetail({ language }: { language: Language }) {
  const t = words[language];
  const { id } = useParams();
  const resource = useResource(`/api/events/${encodeURIComponent(id ?? '')}`, eventDetailSchema);
  const event = resource.data?.event;
  const cover = activityCover('event', event?.title ?? 'Event');
  if (!event) return <div className="story-loading"><LoadState language={language} {...resource} /></div>;
  return <div className="story-page" data-tone={cover.tone}><div className="story-ambient" style={{ backgroundImage: `url(${cover.src})` }} aria-hidden="true" /><div className="story-wrap"><Link className="story-back" to="/events"><Icon name="arrow-left" size={17} />{t.backEvents}</Link><div className="story-grid"><div className="story-aside"><img className="story-cover" src={cover.src} alt="" width="570" height="570" decoding="async" /><div className="story-source"><span className="source-mark"><Icon name="spark" size={22} /></span><div><small>{language === 'de' ? 'Präsentiert von' : 'Presented by'}</small><strong>GSO Engineering Lab</strong></div></div></div><div className="story-main"><div className="story-heading"><h1>{event.title}</h1><span className="story-status">{event.status === 'CANCELLED' ? t.cancelled : event.status === 'COMPLETED' ? t.completed : t.planned}</span></div><div className="story-facts"><EventMoment event={event} language={language} /><EventPlace event={event} language={language} /></div><div className="story-action-bar">{event.plannedDate && event.status !== 'CANCELLED' && <button type="button" onClick={() => downloadCalendar(event)}><Icon name="calendar" size={17} />{t.addCalendar}</button>}{event.placeType === 'OTHER' && event.generalLocation && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.generalLocation)}`} target="_blank" rel="noreferrer"><Icon name="pin" size={17} />{t.maps}</a>}</div><section className="story-body"><h2>{t.about}</h2><div className="story-prose">{event.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{event.materials && <><h3>{language === 'de' ? 'Materialien' : 'Materials'}</h3><p>{event.materials}</p></>}{event.ideaId && <Link className="related-link" to={`/ideas/${event.ideaId}`}><Icon name="idea" size={17} />{t.relatedIdea}<Icon name="arrow-right" size={17} /></Link>}</section></div></div><div className="story-end"><Link to="/events">{t.moreEvents}<Icon name="arrow-right" size={17} /></Link></div></div></div>;
}

function IdeaDetail({ language }: { language: Language }) {
  const t = words[language];
  const { id } = useParams();
  const resource = useResource(`/api/ideas/${encodeURIComponent(id ?? '')}`, ideaDetailSchema);
  const idea = resource.data?.idea;
  const cover = activityCover('idea', idea?.title ?? 'Idea');
  if (!idea) return <div className="story-loading"><LoadState language={language} {...resource} /></div>;
  return <div className="story-page idea-story" data-tone={cover.tone}><div className="story-ambient" style={{ backgroundImage: `url(${cover.src})` }} aria-hidden="true" /><div className="story-wrap"><Link className="story-back" to="/ideas"><Icon name="arrow-left" size={17} />{t.backIdeas}</Link><div className="story-grid"><div className="story-aside"><img className="story-cover" src={cover.src} alt="" width="570" height="570" decoding="async" /><div className="story-source"><span className="source-mark"><Icon name="idea" size={22} /></span><div><small>{t.published}</small><strong>{ideaDate(idea.createdAt, language)}</strong></div></div></div><div className="story-main"><div className="story-heading"><h1>{idea.title}</h1></div><section className="story-body"><h2>{t.theIdea}</h2><div className="story-prose">{idea.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></section></div></div><div className="story-end"><Link to="/ideas">{t.moreIdeas}<Icon name="arrow-right" size={17} /></Link></div></div></div>;
}

export function ShowcaseApp() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('lab-language') === 'en' ? 'en' : 'de');
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => { document.documentElement.lang = language; localStorage.setItem('lab-language', language); }, [language]);
  useEffect(() => { setMobileMenu(false); if (previousPath.current !== location.pathname) { mainRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); previousPath.current = location.pathname; } }, [location.pathname]);
  const t = words[language];
  return <div className="showcase-app"><a className="skip-link" href="#main">{language === 'de' ? 'Zum Inhalt' : 'Skip to content'}</a><header className="showcase-header"><div className="showcase-header-inner"><Link className="showcase-brand" to="/" aria-label="GSO Engineering Lab"><span className="showcase-mark" aria-hidden="true"><span /><span /><span /></span><span>GSO <strong>Lab</strong></span></Link><nav className={mobileMenu ? 'showcase-nav open' : 'showcase-nav'} aria-label={language === 'de' ? 'Hauptnavigation' : 'Main navigation'}><NavLink to="/events"><Icon name="event" size={19} />{t.events}</NavLink><NavLink to="/ideas"><Icon name="idea" size={19} />{t.ideas}</NavLink></nav><div className="showcase-tools"><div className="language-switch" role="group" aria-label={language === 'de' ? 'Sprache' : 'Language'}><button type="button" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>DE</button><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button></div><Link to="/admin" className="admin-link" aria-label={t.admin}><Icon name="settings" size={17} /><span>{t.admin}</span></Link><button type="button" className="mobile-menu-button" aria-label={language === 'de' ? 'Menü' : 'Menu'} aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Icon name={mobileMenu ? 'close' : 'list'} size={22} /></button></div></div></header><main id="main" ref={mainRef} tabIndex={-1}><Suspense fallback={<p className="showcase-load" role="status">{language === 'de' ? 'Lädt …' : 'Loading …'}</p>}><Routes><Route path="/" element={<Landing language={language} />} /><Route path="/home" element={<Navigate to="/" replace />} /><Route path="/events" element={<EventsIndex language={language} />} /><Route path="/events/:id" element={<EventDetail language={language} />} /><Route path="/ideas" element={<IdeasIndex language={language} />} /><Route path="/ideas/:id" element={<IdeaDetail language={language} />} /><Route path="/admin/*" element={<Admin language={language} />} /><Route path="/login" element={<LoginPage language={language} />} /><Route path="*" element={<div className="collection-page"><h1>{t.notFound}</h1><Link to="/">{t.discover}</Link></div>} /></Routes></Suspense></main><footer className="showcase-footer"><div><Link to="/" className="footer-brand">GSO <strong>Lab</strong></Link><span>{t.tagline}</span></div><nav aria-label={language === 'de' ? 'Footer-Navigation' : 'Footer navigation'}><Link to="/events">{t.events}</Link><Link to="/ideas">{t.ideas}</Link><Link to="/admin">{t.admin}</Link></nav></footer></div>;
}
