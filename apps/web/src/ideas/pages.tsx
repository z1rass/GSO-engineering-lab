import { InterestedControl } from '../interested/control';
import { useResource } from '../shared/use-resource';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { ideasCopy } from './copy';
import { activityCover } from '../activity-covers';
import { Icon } from '../shared/icon';

const ideaSchema = z.object({ id: z.number().int(), title: z.string(), description: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
const listSchema = z.object({ ideas: z.array(ideaSchema) });
const detailSchema = z.object({ idea: ideaSchema });
const viewerSchema = z.object({ user: z.object({ role: z.enum(['MEMBER', 'OPS']) }) });
type Idea = z.infer<typeof ideaSchema>;

function LoadingOrError({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = ideasCopy[language];
  return loading ? <p className="load-state" role="status">{t.loading}</p> : status === 404 ? <h1>{t.missing}</h1>
    : <div className="load-state"><p role="alert">{t.error}</p><button className="text-link" onClick={retry}>{t.retry}</button></div>;
}
function IdeaDate({ idea, language }: { idea: Idea; language: Language }) {
  return <p className="idea-date">{ideasCopy[language].published} <time dateTime={idea.createdAt}>{new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium' }).format(new Date(idea.createdAt))}</time></p>;
}
export function IdeasPage({ language }: { language: Language }) {
  const t = ideasCopy[language];
  const resource = useResource('/api/ideas', listSchema);
  return <section className="ideas-page"><div className="ideas-heading"><div><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><div className="create-action"><Link className="button-primary" to="/ideas/new"><Icon name="plus" />{t.share}</Link><p>{t.note}</p></div></div>
    {!resource.data ? <LoadingOrError language={language} {...resource} /> : resource.data.ideas.length ? <ul className="idea-list">{resource.data.ideas.map(idea => <li key={idea.id}>
      <Link to={`/ideas/${idea.id}`}><div><IdeaDate idea={idea} language={language} /><h2>{idea.title}</h2><p className="idea-preview">{idea.description}</p></div><img className="idea-list-cover" src={activityCover('idea', idea.title).src} alt="" width="160" height="160" loading="lazy" decoding="async" /></Link>
    </li>)}</ul> : <div className="ideas-empty"><Icon name="idea" size={28} /><h2>{t.empty}</h2><p>{t.emptyBody}</p><Link className="button-primary" to="/ideas/new"><Icon name="plus" />{t.share}</Link></div>}
  </section>;
}
export function IdeaPage({ language }: { language: Language }) {
  const { id } = useParams();
  const resource = useResource(`/api/ideas/${encodeURIComponent(id ?? '')}`, detailSchema);
  const viewer = useResource('/api/me', viewerSchema);
  const t = ideasCopy[language];
  const idea = resource.data?.idea;
  return <section className="ideas-page idea-detail split-detail"><Link className="text-link back-link" to="/ideas"><Icon name="arrow-left" />{t.back}</Link>
    {!idea ? <LoadingOrError language={language} {...resource} /> : <article className="idea-detail-article" data-cover-tone={activityCover('idea', idea.title).tone}><div className="activity-detail-hero"><div><IdeaDate idea={idea} language={language} /><h1>{idea.title}</h1></div><img className="activity-detail-cover" src={activityCover('idea', idea.title).src} alt="" width="300" height="300" decoding="async" /></div>
      <div className="detail-columns"><div className="detail-main"><section className="detail-section"><h2>{language === 'de' ? 'Die Idee' : 'The idea'}</h2><p className="idea-description">{idea.description}</p></section></div>
        <aside className="detail-sidebar" aria-label={language === 'de' ? 'Interesse und nächste Schritte' : 'Interest and next steps'}>
          <InterestedControl key={idea.id} target={`/ideas/${idea.id}`} language={language} />
          <section className="detail-section idea-next-steps"><h2>{language === 'de' ? 'Idee umsetzen' : 'Build on this idea'}</h2><p>{t.note}</p>
            <div className="idea-actions"><Link className="text-link" to={`/events/new?idea=${idea.id}`}>{language === 'de' ? 'Event daraus erstellen' : 'Create an event from this'}</Link>
              <Link className="text-link" to={`/projects/new?idea=${idea.id}`}>{language === 'de' ? 'Projekt daraus starten' : 'Start a project from this'}</Link>
              {viewer.data?.user.role === 'OPS' && <Link className="text-link" to={`/ideas/${idea.id}/edit`}>{t.edit}</Link>}</div>
            <p className="field-hint">{t.editNote}</p>
          </section>
        </aside>
      </div>
    </article>}
  </section>;
}
function IdeaForm({ language, idea }: { language: Language; idea?: Idea }) {
  const t = ideasCopy[language];
  const navigate = useNavigate();
  const [title, setTitle] = useState(idea?.title ?? '');
  const [coverTitle, setCoverTitle] = useState(idea?.title ?? '');
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
  return <form className={`account-form idea-form creation-form${idea ? '' : ' idea-create-form'}`} data-cover-tone={!idea ? activityCover('idea', coverTitle).tone : undefined} onSubmit={submit} aria-busy={busy}>
    {!idea && <div className="idea-create-art" aria-hidden="true"><img src={activityCover('idea', coverTitle).src} alt="" width="600" height="600" decoding="async" /></div>}
    <label className="creation-title-field">{t.heading}<input value={title} onChange={event => setTitle(event.target.value)} onBlur={() => setCoverTitle(title)} required maxLength={120} placeholder={t.titlePlaceholder} /></label>
    <label>{t.description}<textarea value={description} onChange={event => setDescription(event.target.value)} required maxLength={5000} rows={idea ? 4 : 3} aria-describedby="idea-help" placeholder={t.descriptionPlaceholder} /></label>
    <p id="idea-help" className="field-hint">{t.help}</p>
    {error && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <a className="text-link" href="/login" target="_blank" rel="noopener noreferrer">{t.signIn}</a></>}</p>}
    <div className="account-actions"><button className="button-primary" disabled={busy}>{busy ? t.busy : idea ? t.save : t.publish}</button><Link className="text-link" to={idea ? `/ideas/${idea.id}` : '/ideas'}>{t.cancel}</Link></div>
  </form>;
}
export function IdeaEditor({ language, edit = false }: { language: Language; edit?: boolean }) {
  const { id } = useParams();
  const t = ideasCopy[language];
  const viewer = useResource('/api/me', viewerSchema);
  const resource = useResource(edit ? `/api/ideas/${encodeURIComponent(id ?? '')}` : null, detailSchema);
  return <section className={`ideas-page idea-editor${edit ? '' : ' idea-create-page'}`}><Link className="text-link back-link" to="/ideas"><Icon name="arrow-left" />{t.back}</Link><div className="account-heading"><h1>{edit ? t.edit : t.create}</h1><p>{t.note}</p></div>
    {viewer.loading ? <LoadingOrError language={language} {...viewer} />
      : viewer.status === 401 ? <div className="creation-signin"><p>{t.login}</p><Link className="button-primary" to={`/login?next=${encodeURIComponent(edit ? `/ideas/${id}/edit` : '/ideas/new')}`}>{t.signIn}</Link></div>
      : !viewer.data ? <LoadingOrError language={language} {...viewer} />
      : edit && viewer.data.user.role !== 'OPS' ? <p role="alert">{t.forbidden}</p>
      : edit && !resource.data ? <LoadingOrError language={language} {...resource} />
      : <IdeaForm key={resource.data?.idea.id ?? 'new'} language={language} idea={resource.data?.idea} />}
  </section>;
}
