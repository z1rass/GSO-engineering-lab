import {OpsSeasonsPage,SeasonsPage,SeasonPage,SeasonContents,RecentActivities} from './seasons/pages';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { copy, type Language } from './i18n';
import { Icon } from './shared/icon';

const MyActivityPage = lazy(() => import('./my-activity/page').then(module => ({ default: module.MyActivityPage })));
const NetworkPage = lazy(() => import('./network/page').then(module => ({ default: module.NetworkPage })));
const ModerationPage = lazy(() => import('./moderation/page').then(module => ({ default: module.ModerationPage })));
const ProfileDeletionPage = lazy(() => import('./ops/profile-deletion').then(module => ({ default: module.ProfileDeletionPage })));
const RoomQueue = lazy(() => import('./rooms/pages').then(module => ({ default: module.RoomQueue })));
const EventsPage = lazy(() => import('./events/pages').then(module => ({ default: module.EventsPage })));
const EventPage = lazy(() => import('./events/pages').then(module => ({ default: module.EventPage })));
const EventEditor = lazy(() => import('./events/pages').then(module => ({ default: module.EventEditor })));
const ProjectsPage = lazy(() => import('./projects/pages').then(module => ({ default: module.ProjectsPage })));
const ProjectPage = lazy(() => import('./projects/pages').then(module => ({ default: module.ProjectPage })));
const ProjectEditor = lazy(() => import('./projects/pages').then(module => ({ default: module.ProjectEditor })));
const IdeasPage = lazy(() => import('./ideas/pages').then(module => ({ default: module.IdeasPage })));
const IdeaPage = lazy(() => import('./ideas/pages').then(module => ({ default: module.IdeaPage })));
const IdeaEditor = lazy(() => import('./ideas/pages').then(module => ({ default: module.IdeaEditor })));
const OpsPage = lazy(() => import('./ops/page').then(module => ({ default: module.OpsPage })));
const LoginPage = lazy(() => import('./auth/pages').then(module => ({ default: module.LoginPage })));
const ProfilePage = lazy(() => import('./auth/pages').then(module => ({ default: module.ProfilePage })));
const OwnershipInvitationPage = lazy(() => import('./ownership/panel').then(module => ({ default: module.OwnershipInvitationPage })));

const seasonResponse = z.object({ season: z.object({
  id: z.number().int(), number: z.number().int().nonnegative(), title: z.string(), description: z.string(),
  startsOn: z.iso.date(), endsOn: z.iso.date(), status: z.literal('ACTIVE'),
}).nullable() });
type Season = NonNullable<z.infer<typeof seasonResponse>['season']>;


function Blueprint() {
  return <svg className="blueprint" aria-hidden="true" viewBox="0 0 440 180" fill="none">
    <g stroke="currentColor" strokeWidth="1">
      <path d="M20 30h400M20 90h400M20 150h400M70 10v160M220 10v160M370 10v160" strokeDasharray="2 7" opacity=".2" />
      <g className="frame-back"><path d="m90 42 126-24 62 38-126 24z" fill="var(--diagram-fill)" /><path d="m90 42 62 38v54l-62-38zm62 38 126-24v54l-126 24z" fill="var(--surface)" /></g>
      <g className="frame-front"><path d="m172 86 126-24 62 38-126 24z" fill="var(--diagram-fill)" /><path d="m172 86 62 38v38l-62-38zm62 38 126-24v38l-126 24z" fill="var(--surface)" /></g>
      <path d="M34 30h12m-6-6v12m354 114h12m-6-6v12" />
    </g>
  </svg>;
}

function SeasonCard({ season, language }: { season: Season; language: Language }) {
  const t = copy[language];
  const format = (value: string) => new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
  return <article className="season-card" aria-labelledby="season-title">
    <div className="season-top"><span className="eyebrow">{t.current}</span><span className="status"><i aria-hidden="true" />{t.active}</span></div>
    <div className="season-body"><p className="season-word">Season {season.number}</p><h2 id="season-title">{season.title}</h2><Blueprint /><p className="season-description">{season.description}</p></div>
    <div className="season-dates"><span className="eyebrow">{t.dates}</span><p><time dateTime={season.startsOn}>{format(season.startsOn)}</time><span aria-hidden="true"> — </span><time dateTime={season.endsOn}>{format(season.endsOn)}</time></p></div>
    <div className="season-foot"><Link className="text-link" to={`/seasons/${season.id}`}>{language==='de'?'Season entdecken':'Explore season'}</Link></div>
  </article>;
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('lab-language') === 'en' ? 'en' : 'de');
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recentLoading, setRecentLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const t = copy[language];
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (location.hash && !loading && !recentLoading) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location, loading, recentLoading]);
  useEffect(() => {
    setMenuOpen(false);
    if (previousPath.current !== location.pathname) {
      mainRef.current?.focus({ preventScroll: true });
      if (!location.hash) window.scrollTo(0, 0);
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  useEffect(() => { document.documentElement.lang = language; localStorage.setItem('lab-language', language); }, [language]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void fetch('/api/seasons/current', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(response => {
        if (!response.ok) throw new Error('Season request failed');
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setSeason(seasonResponse.parse(data).season); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt,location.pathname]);

  const currentSeason = <section id="season" className="season-region" aria-busy={loading}>
    {loading ? <div className="season-message" role="status">{t.loading}</div>
      : error ? <div className="season-message" role="alert"><h2>{t.errorTitle}</h2><p>{t.errorBody}</p><button className="button-primary" onClick={() => setAttempt(value => value + 1)}>{t.retry}</button></div>
      : season ? <SeasonCard season={season} language={language} />
      : <div className="season-message"><p className="eyebrow">{t.current}</p><h2>{t.emptyTitle}</h2><p>{t.emptyBody}</p></div>}
  </section>;

  return <>
    <a className="skip-link" href="#main">{t.skip}</a>
    <header className={`site-header page-width${location.pathname === '/' ? ' landing-header' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus(); } }}>
      <div className="header-top">
        <Link to="/" className="brand" aria-label="GSO Engineering Lab"><span className="lab-mark" aria-hidden="true"><span /><span /><span /></span><span className="brand-name" translate="no">GSO <strong>engineering lab</strong></span></Link>
        <div className="header-tools">
          {season&&!error&&<Link className="current-season-link" to={`/seasons/${season.id}`}><span className="season-indicator" aria-hidden="true" />Season {season.number}<span className="current-season-title"> · {season.title}</span></Link>}
          <Link className="account-link" to="/profile"><Icon name="user" />{language === 'de' ? 'Konto' : 'Account'}</Link>
          <div className="languages" role="group" aria-label={language === 'de' ? 'Sprache' : 'Language'}>
            <button type="button" aria-label="Deutsch" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>DE</button>
            <button type="button" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          </div>
          <button ref={menuButtonRef} className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen(open => !open)}><span className="menu-icon" aria-hidden="true"><span /><span /></span>{language === 'de' ? 'Menü' : 'Menu'}</button>
        </div>
      </div>
      <nav id="primary-nav" className={menuOpen ? 'primary-nav is-open' : 'primary-nav'} aria-label={language === 'de' ? 'Hauptnavigation' : 'Main navigation'}>
        <NavLink to="/home" onClick={() => setMenuOpen(false)}><Icon name="home" />{t.homeNav}</NavLink>
        <NavLink to="/events" onClick={() => setMenuOpen(false)}><Icon name="event" />Events</NavLink>
        <NavLink to="/projects" onClick={() => setMenuOpen(false)}><Icon name="project" />{language === 'de' ? 'Projekte' : 'Projects'}</NavLink>
        <NavLink to="/ideas" onClick={() => setMenuOpen(false)}><Icon name="idea" />{language === 'de' ? 'Ideen' : 'Ideas'}</NavLink>
        <NavLink to="/seasons" onClick={() => setMenuOpen(false)}><Icon name="season" />Seasons</NavLink>
        <NavLink className="nav-personal" to="/my-activity" onClick={() => setMenuOpen(false)}><Icon name="user" />{language === 'de' ? 'Mein Lab' : 'My Lab'}</NavLink>
        <div className="mobile-nav-tools">{season&&!error&&<Link to={`/seasons/${season.id}`} onClick={() => setMenuOpen(false)}>Season {season.number} · {season.title}</Link>}<Link to="/profile" onClick={() => setMenuOpen(false)}>{language === 'de' ? 'Konto öffnen' : 'Open account'}</Link></div>
      </nav>
    </header>
    <main id="main" ref={mainRef} tabIndex={-1} className="page-width">
      <Suspense fallback={<p className="route-loading" role="status">{language === 'de' ? 'Seite wird geladen …' : 'Loading page …'}</p>}><Routes>
        <Route path="/ops/moderation" element={<ModerationPage language={language} />} />
        <Route path="/ops/users/:id/profile-deletion" element={<ProfileDeletionPage language={language} />} />
        <Route path="/network" element={<NetworkPage language={language} />} />
        <Route path="/my-activity" element={<MyActivityPage language={language} />} />
        <Route path="/ops/seasons" element={<OpsSeasonsPage language={language}/>} />
        <Route path="/seasons" element={<SeasonsPage language={language}/>} />
        <Route path="/seasons/:id" element={<SeasonPage language={language}/>} />
        <Route path="/ops/rooms" element={<RoomQueue language={language} />} />
        <Route path="/events" element={<EventsPage language={language} />} />
        <Route path="/events/new" element={<EventEditor language={language} />} />
        <Route path="/events/:id" element={<EventPage language={language} />} />
        <Route path="/events/:id/edit" element={<EventEditor language={language} edit />} />
        <Route path="/projects" element={<ProjectsPage language={language} />} />
        <Route path="/projects/new" element={<ProjectEditor language={language} />} />
        <Route path="/projects/:id" element={<ProjectPage language={language} />} />
        <Route path="/projects/:id/edit" element={<ProjectEditor language={language} edit />} />
        <Route path="/ideas" element={<IdeasPage language={language} />} />
        <Route path="/ideas/new" element={<IdeaEditor language={language} />} />
        <Route path="/ideas/:id" element={<IdeaPage language={language} />} />
        <Route path="/ideas/:id/edit" element={<IdeaEditor language={language} edit />} />
        <Route path="/ops" element={<OpsPage language={language} />} />
        <Route path="/login" element={<LoginPage language={language} />} />
        <Route path="/ownership/accept" element={<OwnershipInvitationPage language={language} />} />
        <Route path="/profile" element={<ProfilePage language={language} />} />
        <Route path="/me" element={<ProfilePage language={language} />} />
        <Route path="/" element={<div className="landing-page">
          <div className="landing-hero"><section className="hero-copy"><h1>{t.headline}<br/><span>{t.emphasis}</span></h1><p className="intro">{t.introduction}</p><div className="hero-actions"><Link className="button-primary" to="/home">{t.exploreLab}<Icon name="arrow-right" /></Link><a className="text-link" href="#about">{t.secondary}<Icon name="chevron-down" size={16} /></a></div></section><aside className="landing-wayfinder" aria-label={language === 'de' ? 'Im Lab entdecken' : 'Explore the Lab'}><span className="landing-wayfinder-label">GSO / LAB</span><nav aria-label={language === 'de' ? 'Direkt zu den Aktivitäten' : 'Go to activities'}><Link to="/events"><Icon name="event" /><strong>Events</strong><Icon name="arrow-right" /></Link><Link to="/projects"><Icon name="project" /><strong>{language === 'de' ? 'Projekte' : 'Projects'}</strong><Icon name="arrow-right" /></Link><Link to="/ideas"><Icon name="idea" /><strong>{language === 'de' ? 'Ideen' : 'Ideas'}</strong><Icon name="arrow-right" /></Link></nav><p>{language === 'de' ? 'Entdecken, mitmachen, selbst starten.' : 'Explore, join in, start something.'}</p></aside></div>
          <section className="landing-process" aria-labelledby="process-title"><h2 id="process-title">{t.landingFlowTitle}</h2><ol className="landing-flow">{t.landingFlow.map(([number,title,body])=><li className="landing-flow-step" key={number}><span aria-hidden="true">{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
          <section id="about" className="landing-intro"><h2>{t.landingWhatTitle}</h2><p>{t.landingWhatBody}</p></section>
          <section className="landing-values"><h2>{t.landingValuesTitle}</h2><div>{t.landingValues.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
          <section className="landing-audience"><h2>{t.landingAudienceTitle}</h2><div><p>{t.landingAudienceBody}</p><p className="landing-audience-types">{t.landingFor}</p></div></section>
          <section className="landing-cta"><h2>{t.landingCtaTitle}</h2><p>{t.landingCtaBody}</p><div className="hero-actions"><Link className="button-primary" to="/home">{t.exploreLab}</Link><Link className="text-link" to="/ideas">{t.exploreIdeas}</Link></div></section>
        </div>} />
        <Route path="/home" element={<div className="home-page"><div className="home-heading"><h1>{t.homeTitle}</h1><p className="intro">{t.homeIntro}</p><div className="home-links"><Link to="/events"><Icon name="event" />Events</Link><Link to="/projects"><Icon name="project" />{language==='de'?'Projekte':'Projects'}</Link><Link to="/ideas"><Icon name="idea" />{language==='de'?'Ideen':'Ideas'}</Link></div></div><section className="home-start" aria-labelledby="home-start-title"><h2 id="home-start-title">{t.homeStartTitle}</h2><div className="home-start-options"><Link to="/ideas/new"><Icon name="idea" size={22} /><strong>{t.homeIdeaAction}</strong><span>{t.homeIdeaLead}</span><Icon name="arrow-right" /></Link><Link to="/projects/new"><Icon name="project" size={22} /><strong>{t.homeProjectAction}</strong><span>{t.homeProjectLead}</span><Icon name="arrow-right" /></Link></div></section><section className="home-season" aria-label={t.current}><div className="home-section-heading"><h2>{language==='de'?'In dieser Season':'This season'}</h2><Link className="text-link" to="/seasons">{language==='de'?'Alle Seasons':'All seasons'}<Icon name="arrow-right" size={16} /></Link></div>{currentSeason}</section><RecentActivities language={language} onLoadingChange={setRecentLoading}/></div>} />
        <Route path="/season" element={<div className="season-page"><Link className="text-link back-link" to="/home"><Icon name="arrow-left" />{t.back}</Link><h1>{t.periodNote}</h1><Link className="text-link" to="/seasons">{language==='de'?'Alle Seasons':'All seasons'}</Link>{currentSeason}{season&&!loading&&!error&&<SeasonContents id={season.id} language={language}/>}</div>} />
        <Route path="*" element={<section className="season-page"><h1>{t.notFound}</h1><Link to="/">{t.back}</Link></section>} />
      </Routes></Suspense>
    </main>
    <footer className="page-width site-footer"><span className="footer-brand" translate="no">GSO <strong>engineering lab</strong></span><span>{t.footer}</span><span className="footer-tagline">{t.tagline}</span></footer>
  </>;
}
