import { ActivitySeasons } from '../seasons/panel';
import { LifecyclePanel } from '../lifecycle/panel';
import { OwnershipPanel } from '../ownership/panel';
import { TaskPanel } from '../tasks/panel';
import { RoomPanel } from '../rooms/pages';
import { ProjectTeam } from './team';
import { InterestedControl } from '../interested/control';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';
import { projectCopy } from './copy';

const linkSchema = z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).nullable();
const projectSchema = z.object({ id: z.number(), title: z.string(), goal: z.string(), description: z.string(), techStack: z.array(z.string()),
  status: z.enum(['PLANNING','ACTIVE','COMPLETED','CANCELLED']), ideaId: z.number().nullable(), materials: z.string(), repositoryUrl: linkSchema, documentationUrl: linkSchema,
  owner: z.object({ id: z.string(), name: z.string() }).optional(), privateInstructions: z.string().optional(), discordUrl: linkSchema.optional(), canEdit: z.boolean().optional(), canClose: z.boolean().optional(),
});
const detailSchema = z.object({ project: projectSchema });
const listSchema = z.object({ projects: z.array(projectSchema) });
const viewerSchema = z.object({ user: z.object({ id: z.string() }) });
const ideasSchema = z.object({ ideas: z.array(z.object({ id: z.number(), title: z.string() })) });
type Project = z.infer<typeof projectSchema>;
function LoadState({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = projectCopy[language];
  return loading ? <p role="status">{t.loading}</p> : status === 404 ? <h1>{t.missing}</h1> : <div><p role="alert">{t.error}</p><button className="text-link" onClick={retry}>{t.retry}</button></div>;
}
export function ProjectsPage({ language }: { language: Language }) {
  const t = projectCopy[language];
  const resource = useResource('/api/projects', listSchema);
  const [view,setView]=useSearchParams();
  const past=view.get('view')==='past';
  const setPast=(value:boolean)=>setView(value?{view:'past'}:{});
  const visible=resource.data?.projects.filter(item=>['COMPLETED','CANCELLED'].includes(item.status)===past);
  return <section className="ideas-page"><div className="ideas-heading"><div><p className="eyebrow">GSO engineering lab / {t.nav}</p><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><Link className="button-primary" to="/projects/new">{t.create} ↗</Link></div>
    <div className="account-actions archive-tabs"><button className="text-link" aria-pressed={!past} onClick={()=>setPast(false)}>{language==='de'?'Aktuell':'Current'}</button><button className="text-link" aria-pressed={past} onClick={()=>setPast(true)}>{language==='de'?'Vergangene':'Past'}</button></div>
    {!resource.data ? <LoadState language={language} {...resource} /> : visible?.length ? <ul className="idea-list">{visible.map(project => <li key={project.id}><Link to={`/projects/${project.id}`}><div><span className="status">{t[project.status]}</span><h2>{project.title}</h2><p className="idea-preview">{project.goal}</p><p className="project-stack">{project.techStack.join(' / ')}</p></div><span className="idea-arrow" aria-hidden="true">↗</span></Link></li>)}</ul>
    : <div className="ideas-empty project-empty"><h2>{past?(language==='de'?'Noch keine vergangenen Aktivitäten.':'No past activities yet.'):t.empty}</h2>{!past&&<p>{t.emptyBody}</p>}</div>}
  </section>;
}
export function ProjectPage({ language }: { language: Language }) {
  const { id } = useParams();
  const t = projectCopy[language];
  const resource = useResource(`/api/projects/${encodeURIComponent(id ?? '')}`, detailSchema);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const project = resource.data?.project;
  const closed=!!project && ['COMPLETED','CANCELLED'].includes(project.status);
  async function start() {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/projects/${project!.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Cannot start');
      resource.retry();
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <section className="ideas-page idea-detail"><Link className="text-link" to={closed?'/projects?view=past':'/projects'}>← {t.back}</Link>
    {!project ? <LoadState language={language} {...resource} /> : <article className="project-detail"><span className="status">{t[project.status]}</span><h1>{project.title}</h1><p className="project-goal">{project.goal}</p>
      {project.owner && <p className="project-owner">{t.owner}: <strong>{project.owner.name}</strong></p>}
      <ActivitySeasons key={`seasons-${project.id}`} id={project.id} language={language} project/>
      <p className="idea-description">{project.description}</p>
      {!closed&&<InterestedControl key={project.id} target={`/projects/${project.id}`} language={language} />}
      {!!project.techStack.length && <p className="project-stack">{project.techStack.join(' / ')}</p>}
      <div className="project-links">{project.repositoryUrl && <a className="text-link" href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">{t.repositoryUrl} ↗</a>}{project.documentationUrl && <a className="text-link" href={project.documentationUrl} target="_blank" rel="noopener noreferrer">{t.documentationUrl} ↗</a>}{project.ideaId && <Link className="text-link" to={`/ideas/${project.ideaId}`}>{t.source} ↗</Link>}</div>
      {project.materials && <section><h2>{t.materials}</h2><p className="idea-description">{project.materials}</p></section>}
      {project.owner ? (project.privateInstructions || project.discordUrl) && <section className="project-private"><p className="eyebrow">{t.membersOnly}</p>{project.privateInstructions && <><h2>{t.privateInstructions}</h2><p className="idea-description">{project.privateInstructions}</p></>}{project.discordUrl && <a className="text-link" href={project.discordUrl} target="_blank" rel="noopener noreferrer">Discord ↗</a>}</section>
        : <p className="ideas-note">{t.privateLogin} <Link className="text-link" to="/login">{t.signIn} ↗</Link></p>}
      <ProjectTeam closed={closed} key={`team-${project.id}`} id={project.id} language={language} />
      <TaskPanel closed={closed} key={`tasks-${project.id}`} id={project.id} language={language} />
      <RoomPanel key={`room-${project.id}`} id={project.id} language={language} />
      {!closed&&project.owner && <OwnershipPanel key={`ownership-${project.id}`} id={project.id} language={language} refresh={resource.retry} />}
      {project.canClose && <LifecyclePanel id={project.id} language={language} refresh={resource.retry} />}
      {project.canEdit && <div className="account-actions project-actions"><Link className="text-link" to={`/projects/${project.id}/edit`}>{t.edit}</Link>{project.status === 'PLANNING' && <button className="button-primary" disabled={busy} onClick={() => void start()}>{busy ? t.starting : t.start}</button>}</div>}
      {error && <p className="form-error" role="alert">{t.error}</p>}
    </article>}
  </section>;
}
function ProjectForm({ language, project }: { language: Language; project?: Project }) {
  const t = projectCopy[language];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ideas = useResource(project ? null : '/api/ideas', ideasSchema);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'invalid' | 'session' | 'forbidden' | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const form = new FormData(event.currentTarget);
    const body = { title: String(form.get('title')).trim(), goal: String(form.get('goal')).trim(), description: String(form.get('description')).trim(),
      techStack: String(form.get('techStack')).split(',').map(s => s.trim()).filter(Boolean), repositoryUrl: form.get('repositoryUrl') || null, documentationUrl: form.get('documentationUrl') || null,
      materials: form.get('materials'), privateInstructions: form.get('privateInstructions'), discordUrl: form.get('discordUrl') || null,
      ...(!project ? { ideaId: form.get('ideaId') ? Number(form.get('ideaId')) : null } : {}),
    };
    if (!body.title || !body.goal || !body.description) { setError('invalid'); return; }
    setBusy(true);
    try {
      const response = await fetch(project ? `/api/projects/${project.id}` : '/api/projects', { method: project ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 401 ? 'session' : response.status === 403 ? 'forbidden' : response.status === 400 ? 'invalid' : 'error'); return; }
      const id = project?.id ?? detailSchema.parse(await response.json()).project.id;
      navigate(`/projects/${id}`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <form className="account-form idea-form" onSubmit={submit} aria-busy={busy}>
    <label>{t.titleField}<input name="title" required maxLength={120} defaultValue={project?.title} /></label>
    <label><span id="project-goal-label">{t.goal}</span><textarea aria-labelledby="project-goal-label" name="goal" required maxLength={1000} rows={2} defaultValue={project?.goal} /></label>
    <label><span id="project-description-label">{t.description}</span><textarea aria-labelledby="project-description-label" name="description" required maxLength={5000} rows={5} defaultValue={project?.description} /></label>
    <p className="field-hint">{t.publicHint}</p>
    {!project && (ideas.data ? <label><span id="project-idea-label">{t.idea}</span><select name="ideaId" aria-labelledby="project-idea-label" defaultValue={params.get('idea') ?? ''}><option value="">{t.noIdea}</option>{ideas.data.ideas.map(idea => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label> : <LoadState language={language} {...ideas} />)}
    <details className="project-form-section"><summary>{t.resources}</summary><div>
      <label>{t.techStack}<input name="techStack" defaultValue={project?.techStack.join(', ')} aria-describedby="stack-hint" /></label><p className="field-hint" id="stack-hint">{t.stackHint}</p>
      <label>{t.repositoryUrl}<input type="url" name="repositoryUrl" maxLength={2000} defaultValue={project?.repositoryUrl ?? ''} /></label>
      <label>{t.documentationUrl}<input type="url" name="documentationUrl" maxLength={2000} defaultValue={project?.documentationUrl ?? ''} /></label>
      <label><span id="project-materials-label">{t.materials}</span><textarea aria-labelledby="project-materials-label" name="materials" maxLength={5000} rows={4} defaultValue={project?.materials} /></label>
    </div></details>
    <details className="project-form-section"><summary>{t.membersOnly}</summary><div><p className="field-hint">{t.privateHint}</p>
      <label><span id="project-privateInstructions-label">{t.privateInstructions}</span><textarea aria-labelledby="project-privateInstructions-label" name="privateInstructions" maxLength={5000} rows={4} defaultValue={project?.privateInstructions} /></label>
      <label>{t.discordUrl}<input type="url" name="discordUrl" maxLength={2000} defaultValue={project?.discordUrl ?? ''} /></label>
    </div></details>
    {error && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <a className="text-link" href="/login" target="_blank" rel="noopener noreferrer">{t.signIn} ↗</a></>}</p>}
    <div className="account-actions"><button className="button-primary" disabled={busy || (!project && !ideas.data)}>{busy ? t.saving : project ? t.save : t.create}</button><Link className="text-link" to={project ? `/projects/${project.id}` : '/projects'}>{t.cancel}</Link></div>
  </form>;
}
export function ProjectEditor({ language, edit = false }: { language: Language; edit?: boolean }) {
  const { id } = useParams();
  const t = projectCopy[language];
  const viewer = useResource('/api/me', viewerSchema);
  const resource = useResource(edit ? `/api/projects/${encodeURIComponent(id ?? '')}` : null, detailSchema);
  return <section className="ideas-page idea-editor"><Link className="text-link" to="/projects">← {t.back}</Link><div className="account-heading"><h1>{edit ? t.edit : t.newTitle}</h1>{!edit && <p>{t.ownership}</p>}</div>
    {viewer.loading ? <LoadState language={language} {...viewer} /> : viewer.status === 401 ? <p>{t.login} <Link className="text-link" to="/login">{t.signIn} ↗</Link></p>
      : !viewer.data ? <LoadState language={language} {...viewer} /> : edit && !resource.data ? <LoadState language={language} {...resource} />
      : edit && !resource.data?.project.canEdit ? <p role="alert">{t.forbidden}</p>
      : <ProjectForm key={resource.data?.project.id ?? 'new'} language={language} project={resource.data?.project} />}
  </section>;
}
