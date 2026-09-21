import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { copy, type Language } from './i18n';

const seasonResponse = z.object({ season: z.object({
  id: z.number().int(), number: z.number().int().nonnegative(), title: z.string(), description: z.string(),
  startsOn: z.iso.date(), endsOn: z.iso.date(), status: z.literal('ACTIVE'),
}).nullable() });
type Season = NonNullable<z.infer<typeof seasonResponse>['season']>;

function Arrow() { return <span aria-hidden="true">↗</span>; }

function SeasonCard({ season, language }: { season: Season; language: Language }) {
  const t = copy[language];
  const format = (value: string) => new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
  return <article className="season-card" aria-labelledby="season-title">
    <div className="season-top"><span className="eyebrow">{t.current}</span><span className="status"><i aria-hidden="true" />{t.active}</span></div>
    <div className="season-identity"><span className="season-word">SEASON</span><span className="season-number" aria-label={`Season ${season.number}`}>{String(season.number).padStart(2, '0')}</span></div>
    <div className="season-body"><h2 id="season-title">{season.title}</h2><p>{season.description}</p></div>
    <div className="season-dates"><span className="eyebrow">{t.dates}</span><p><time dateTime={season.startsOn}>{format(season.startsOn)}</time><span aria-hidden="true"> — </span><time dateTime={season.endsOn}>{format(season.endsOn)}</time></p></div>
    <div className="season-foot"><span>{t.community}</span><span className="corner-mark" aria-hidden="true">+</span></div>
  </article>;
}

export function App() {
  const [language, setLanguage] = useState<Language>('de');
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = copy[language];
  const location = useLocation();

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
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
      <Link to="/" className="brand" aria-label="GSO Engineering Lab"><span className="brand-mark" aria-hidden="true">GSO<span>↗</span></span><span>ENGINEERING<br />LAB</span></Link>
      <nav aria-label={language === 'de' ? 'Hauptnavigation' : 'Main navigation'}><Link to="/season">{t.seasonNav}</Link><Link to="/#about" className="about-link">{t.about}</Link></nav>
      <div className="languages" aria-label={language === 'de' ? 'Sprache' : 'Language'}>
        <button aria-label="Deutsch" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>DE</button>
        <button aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      </div>
    </header>
    <main id="main" className="page-width">
      <Routes>
        <Route path="/" element={<>
          <div className="hero-grid">
            <section className="hero-copy"><p className="eyebrow hero-eyebrow"><span aria-hidden="true">↳</span> {t.eyebrow}</p>
              <h1>{t.headline}<br /><span>{t.emphasis}</span></h1><p className="intro">{t.introduction}</p>
              <div className="hero-actions"><a className="button-primary" href="#season">{t.seasonNav}<Arrow /></a><a className="text-link" href="#about">{t.secondary}<span aria-hidden="true">↓</span></a></div>
              <div className="hero-bottom"><span className="eyebrow">{t.tagline}</span><span className="crosshair" aria-hidden="true">+</span></div>
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
    <footer className="page-width site-footer"><span>GSO ENGINEERING LAB</span><span>{t.footer}</span><span>KÖLN / COLOGNE</span></footer>
  </>;
}
