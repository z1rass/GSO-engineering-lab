import { EventsPage, EventPage, EventEditor } from './events/pages';
import { ProjectsPage, ProjectPage, ProjectEditor } from './projects/pages';
import { IdeasPage, IdeaPage, IdeaEditor } from './ideas/pages';
import { OpsPage } from './ops/page';
import { LoginPage, ProfilePage } from './auth/pages';
import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { copy, type Language } from './i18n';

const seasonResponse = z.object({ season: z.object({
  id: z.number().int(), number: z.number().int().nonnegative(), title: z.string(), description: z.string(),
  startsOn: z.iso.date(), endsOn: z.iso.date(), status: z.literal('ACTIVE'),
}).nullable() });
type Season = NonNullable<z.infer<typeof seasonResponse>['season']>;

function Arrow() { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 19 19 5M5 5h14v14" /></svg>; }

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
    <div className="season-foot"><span>{t.community}</span></div>
  </article>;
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('lab-language') === 'en' ? 'en' : 'de');
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = copy[language];
  const location = useLocation();

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location]);
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
  }, [attempt]);

  const currentSeason = <section id="season" className="season-region" aria-busy={loading}>
    {loading ? <div className="season-message" role="status">{t.loading}</div>
      : error ? <div className="season-message" role="alert"><h2>{t.errorTitle}</h2><p>{t.errorBody}</p><button className="button-primary" onClick={() => setAttempt(value => value + 1)}>{t.retry}<Arrow /></button></div>
      : season ? <SeasonCard season={season} language={language} />
      : <div className="season-message"><p className="eyebrow">{t.current}</p><h2>{t.emptyTitle}</h2><p>{t.emptyBody}</p></div>}
  </section>;

  return <>
    <a className="skip-link" href="#main">{t.skip}</a>
    <header className="site-header page-width">
      <Link to="/" className="brand" aria-label="GSO Engineering Lab"><span className="lab-mark" aria-hidden="true"><span /><span /><span /></span><span className="brand-name">GSO <strong>engineering lab</strong></span></Link>
      <nav aria-label={language === 'de' ? 'Hauptnavigation' : 'Main navigation'}><NavLink to="/season">{t.seasonNav}</NavLink><NavLink to="/events">Events</NavLink><NavLink to="/projects">{language === 'de' ? 'Projekte' : 'Projects'}</NavLink><NavLink to="/ideas">{language === 'de' ? 'Ideen' : 'Ideas'}</NavLink><Link to="/#about" className="about-link">{t.about}</Link><NavLink to="/profile">{language === 'de' ? 'Mein Lab' : 'My Lab'}</NavLink></nav>
      <div className="languages" aria-label={language === 'de' ? 'Sprache' : 'Language'}>
        <button aria-label="Deutsch" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>DE</button>
        <button aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      </div>
    </header>
    <main id="main" className="page-width">
      <Routes>
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
        <Route path="/profile" element={<ProfilePage language={language} />} />
        <Route path="/me" element={<ProfilePage language={language} />} />
        <Route path="/" element={<>
          <div className="hero-grid">
            <section className="hero-copy"><p className="eyebrow hero-eyebrow">{t.eyebrow}</p>
              <h1>{t.headline}<br /><span>{t.emphasis}</span></h1><p className="intro">{t.introduction}</p>
              <div className="hero-actions"><a className="button-primary" href="#season">{t.seasonNav}<Arrow /></a><a className="text-link" href="#about">{t.secondary}<span aria-hidden="true">↓</span></a></div>

            </section>{currentSeason}
          </div>
          <section id="about" className="about-section"><div className="about-heading"><p className="eyebrow">{t.model}</p><h2>{t.discoverTitle}</h2><p>{t.discoverIntro}</p></div>
            <div className="steps">{t.steps.map(([title, body], index) => <article key={index}><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          </section>
        </>} />
        <Route path="/season" element={<div className="season-page"><Link className="text-link" to="/">← {t.back}</Link><h1>{t.periodNote}</h1>{currentSeason}</div>} />
        <Route path="*" element={<section className="season-page"><h1>{t.notFound}</h1><Link to="/">{t.back}</Link></section>} />
      </Routes>
    </main>
    <footer className="page-width site-footer"><span className="footer-brand">GSO <strong>engineering lab</strong></span><span>{t.footer}</span><span className="footer-tagline">{t.tagline}</span></footer>
  </>;
}
