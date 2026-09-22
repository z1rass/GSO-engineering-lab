import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { ideasCopy } from './copy';

const ideaSchema = z.object({ id: z.number().int(), title: z.string(), description: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
const listSchema = z.object({ ideas: z.array(ideaSchema) });
const detailSchema = z.object({ idea: ideaSchema });
const viewerSchema = z.object({ user: z.object({ role: z.enum(['MEMBER', 'OPS']) }) });
type Idea = z.infer<typeof ideaSchema>;

function useResource<T>(path: string | null, schema: z.ZodType<T>) {
  const [result, setResult] = useState<{ data: T | null; status: number; loading: boolean }>({ data: null, status: 0, loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) { setResult({ data: null, status: 200, loading: false }); return; }
    const controller = new AbortController();
    setResult({ data: null, status: 0, loading: true });
    void fetch(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async response => {
      const data = response.ok ? schema.parse(await response.json()) : null;
      if (!controller.signal.aborted) setResult({ data, status: response.status, loading: false });
    }).catch(() => { if (!controller.signal.aborted) setResult({ data: null, status: 503, loading: false }); });
    return () => controller.abort();
  }, [path, schema, attempt]);
  return { ...result, retry: () => setAttempt(n => n + 1) };
}
function LoadingOrError({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = ideasCopy[language];
  return loading ? <p role="status">{t.loading}</p> : status === 404 ? <h1>{t.missing}</h1>
    : <div><p role="alert">{t.error}</p><button className="text-link" onClick={retry}>{t.retry}</button></div>;
}
function IdeaDate({ idea, language }: { idea: Idea; language: Language }) {
  return <p className="idea-date">{ideasCopy[language].published} <time dateTime={idea.createdAt}>{new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium' }).format(new Date(idea.createdAt))}</time></p>;
}
export function IdeasPage({ language }: { language: Language }) {
  const t = ideasCopy[language];
  const resource = useResource('/api/ideas', listSchema);
  return <section className="ideas-page"><div className="ideas-heading"><div><p className="eyebrow">GSO engineering lab / {t.nav}</p><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><Link className="button-primary" to="/ideas/new">{t.share}<span aria-hidden="true">↗</span></Link></div>
    <p className="ideas-note">{t.note}</p>
    {!resource.data ? <LoadingOrError language={language} {...resource} /> : resource.data.ideas.length ? <ul className="idea-list">{resource.data.ideas.map(idea => <li key={idea.id}>
      <Link to={`/ideas/${idea.id}`}><div><IdeaDate idea={idea} language={language} /><h2>{idea.title}</h2><p className="idea-preview">{idea.description}</p></div><span className="idea-arrow" aria-hidden="true">↗</span></Link>
    </li>)}</ul> : <div className="ideas-empty"><h2>{t.empty}</h2><p>{t.emptyBody}</p></div>}
  </section>;
}
export function IdeaPage({ language }: { language: Language }) {
  const { id } = useParams();
  const resource = useResource(`/api/ideas/${encodeURIComponent(id ?? '')}`, detailSchema);
  const viewer = useResource('/api/me', viewerSchema);
  const t = ideasCopy[language];
  const idea = resource.data?.idea;
  return <section className="ideas-page idea-detail"><Link className="text-link" to="/ideas">← {t.back}</Link>
    {!idea ? <LoadingOrError language={language} {...resource} /> : <article><IdeaDate idea={idea} language={language} /><h1>{idea.title}</h1><p className="idea-description">{idea.description}</p>
      <aside className="ideas-note"><p>{t.note}</p><p>{t.editNote}</p></aside>
      {viewer.data?.user.role === 'OPS' && <Link className="text-link" to={`/ideas/${idea.id}/edit`}>{t.edit} ↗</Link>}
    </article>}
  </section>;
}
function IdeaForm({ language, idea }: { language: Language; idea?: Idea }) {
  const t = ideasCopy[language];
  const navigate = useNavigate();
  const [title, setTitle] = useState(idea?.title ?? '');
  const [description, setDescription] = useState(idea?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'invalid' | 'session' | 'forbidden' | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (!title.trim() || !description.trim()) { setError('invalid'); return; }
    setBusy(true);
    try {
      const response = await fetch(idea ? `/api/ideas/${idea.id}` : '/api/ideas', { method: idea ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 401 ? 'session' : response.status === 403 ? 'forbidden' : response.status === 400 ? 'invalid' : 'error'); return; }
      const saved = detailSchema.parse(await response.json());
      navigate(`/ideas/${saved.idea.id}`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <form className="account-form idea-form" onSubmit={submit} aria-busy={busy}>
    <label>{t.heading}<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} /></label>
    <label>{t.description}<textarea value={description} onChange={event => setDescription(event.target.value)} required maxLength={5000} rows={8} aria-describedby="idea-help" /></label>
    <p id="idea-help" className="field-hint">{t.help}</p>
    {error && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <a className="text-link" href="/login" target="_blank" rel="noopener noreferrer">{t.signIn} ↗</a></>}</p>}
    <div className="account-actions"><button className="button-primary" disabled={busy}>{busy ? t.busy : idea ? t.save : t.publish}</button><Link className="text-link" to={idea ? `/ideas/${idea.id}` : '/ideas'}>{t.cancel}</Link></div>
  </form>;
}
export function IdeaEditor({ language, edit = false }: { language: Language; edit?: boolean }) {
  const { id } = useParams();
  const t = ideasCopy[language];
  const viewer = useResource('/api/me', viewerSchema);
  const resource = useResource(edit ? `/api/ideas/${encodeURIComponent(id ?? '')}` : null, detailSchema);
  return <section className="ideas-page idea-editor"><Link className="text-link" to="/ideas">← {t.back}</Link><div className="account-heading"><h1>{edit ? t.edit : t.create}</h1><p>{t.note}</p></div>
    {viewer.loading ? <LoadingOrError language={language} {...viewer} />
      : viewer.status === 401 ? <div><p>{t.login}</p><Link className="text-link" to="/login">{t.signIn} ↗</Link></div>
      : !viewer.data ? <LoadingOrError language={language} {...viewer} />
      : edit && viewer.data.user.role !== 'OPS' ? <p role="alert">{t.forbidden}</p>
      : edit && !resource.data ? <LoadingOrError language={language} {...resource} />
      : <IdeaForm key={resource.data?.idea.id ?? 'new'} language={language} idea={resource.data?.idea} />}
  </section>;
}
