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
import { activityCover } from '../activity-covers';
import { Icon } from '../shared/icon';

const linkSchema = z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).nullable();
const projectSchema = z.object({ id: z.number(), title: z.string(), goal: z.string(), description: z.string(), techStack: z.array(z.string()),
  status: z.enum(['PLANNING','ACTIVE','COMPLETED','CANCELLED']), ideaId: z.number().nullable(), materials: z.string(), repositoryUrl: linkSchema, documentationUrl: linkSchema,
  owner: z.object({ id: z.string(), name: z.string() }).optional(), privateInstructions: z.string().optional(), discordUrl: linkSchema.optional(), canEdit: z.boolean().optional(), canClose: z.boolean().optional(),
});
const detailSchema = z.object({ project: projectSchema });
const listSchema = z.object({ projects: z.array(projectSchema) });
const viewerSchema = z.object({ user: z.object({ id: z.string() }) });
type Project = z.infer<typeof projectSchema>;
function LoadState({ language, loading, status, retry }: { language: Language; loading: boolean; status: number; retry: () => void }) {
  const t = projectCopy[language];
  return loading ? <p className="load-state" role="status">{t.loading}</p> : status === 404 ? <h1>{t.missing}</h1> : <div className="load-state"><p role="alert">{t.error}</p><button className="text-link" onClick={retry}>{t.retry}</button></div>;
}
export function ProjectsPage({ language }: { language: Language }) {
  const t = projectCopy[language];
  const resource = useResource('/api/projects', listSchema);
  const [view,setView]=useSearchParams();
  const past=view.get('view')==='past';
  const setPast=(value:boolean)=>setView(value?{view:'past'}:{});
  const visible=resource.data?.projects.filter(item=>['COMPLETED','CANCELLED'].includes(item.status)===past);
  return <section className="ideas-page"><div className="ideas-heading"><div><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><div className="create-action"><Link className="button-primary" to="/projects/new"><Icon name="plus" />{t.create}</Link><p>{t.quickStart}</p></div></div>
    <div className="account-actions archive-tabs"><button className="text-link" aria-pressed={!past} onClick={()=>setPast(false)}>{language==='de'?'Aktuell':'Current'}</button><button className="text-link" aria-pressed={past} onClick={()=>setPast(true)}>{language==='de'?'Vergangene':'Past'}</button></div>
    {!resource.data ? <LoadState language={language} {...resource} /> : visible?.length ? <ul className="idea-list project-list">{visible.map(project => <li key={project.id}><Link to={`/projects/${project.id}`}><div><span className="status">{t[project.status]}</span><h2>{project.title}</h2><p className="idea-preview">{project.goal}</p><p className="project-stack">{project.techStack.join(' / ')}</p></div><img className="project-list-cover" src={activityCover('project', project.title).src} alt="" width="160" height="160" loading="lazy" decoding="async" /></Link></li>)}</ul>
    : <div className="ideas-empty project-empty"><Icon name="project" size={28} /><h2>{past?(language==='de'?'Noch keine vergangenen Aktivitäten.':'No past activities yet.'):t.empty}</h2>{!past&&<><p>{t.emptyBody}</p><Link className="button-primary" to="/projects/new"><Icon name="plus" />{t.create}</Link></>}</div>}
  </section>;
}
export function ProjectPage({ language }: { language: Language }) {
  const { id } = useParams();
  const t = projectCopy[language];
  const resource = useResource(`/api/projects/${encodeURIComponent(id ?? '')}`, detailSchema);
  const project = resource.data?.project;
  const closed=!!project && ['COMPLETED','CANCELLED'].includes(project.status);
  return <section className="ideas-page idea-detail split-detail"><Link className="text-link back-link" to={closed?'/projects?view=past':'/projects'}><Icon name="arrow-left" />{t.back}</Link>
    {!project ? <LoadState language={language} {...resource} /> : <article className="project-detail" data-cover-tone={activityCover('project', project.title).tone}><div className="activity-detail-hero"><div><div className="detail-topline"><span className="status">{t[project.status]}</span>{project.canEdit&&<Link className="management-link" to={`/projects/${project.id}/edit`}>{t.edit}</Link>}</div><h1>{project.title}</h1></div><img className="activity-detail-cover" src={activityCover('project', project.title).src} alt="" width="300" height="300" decoding="async" /></div>
      <div className="detail-metadata">{project.owner && <p className="project-owner">{t.owner}: <strong>{project.owner.name}</strong></p>}<ActivitySeasons key={`seasons-${project.id}`} id={project.id} language={language}/></div>
      <div className="detail-columns project-columns"><div className="detail-main">
        <section className="project-goal-panel"><h2>{t.goal}</h2><p className="project-goal">{project.goal}</p></section>
        {project.description && <section className="detail-section"><h2>{language === 'de' ? 'Über das Projekt' : 'About this project'}</h2><p className="idea-description">{project.description}</p></section>}
      </div><aside className="detail-sidebar" aria-label={language === 'de' ? 'Teilnahme und Projektressourcen' : 'Participation and project resources'}>
        {!closed&&<InterestedControl key={project.id} target={`/projects/${project.id}`} language={language} />}
        <ProjectTeam closed={closed} key={`team-${project.id}`} id={project.id} language={language} />
        {!!(project.techStack.length || project.repositoryUrl || project.documentationUrl || project.ideaId) && <section className="detail-section project-resources"><h2>{t.resources}</h2>
          {!!project.techStack.length && <div className="project-stack-group"><h3>{t.techStack}</h3><ul className="project-stack-list">{project.techStack.map(item=><li key={item}>{item}</li>)}</ul></div>}
          <div className="project-links">{project.repositoryUrl && <a className="text-link" href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">{t.repositoryUrl}</a>}{project.documentationUrl && <a className="text-link" href={project.documentationUrl} target="_blank" rel="noopener noreferrer">{t.documentationUrl}</a>}{project.ideaId && <Link className="text-link" to={`/ideas/${project.ideaId}`}>{t.source}</Link>}</div>
        </section>}
      </aside><div className="detail-more">
        {project.materials && <section className="detail-section"><h2>{t.materials}</h2><p className="idea-description">{project.materials}</p></section>}
        {project.owner ? (project.privateInstructions || project.discordUrl) && <section className="project-private"><p className="eyebrow">{t.membersOnly}</p>{project.privateInstructions && <><h2>{t.privateInstructions}</h2><p className="idea-description">{project.privateInstructions}</p></>}{project.discordUrl && <a className="text-link" href={project.discordUrl} target="_blank" rel="noopener noreferrer">Discord</a>}</section>
          : <p className="ideas-note">{t.privateLogin} <Link className="text-link" to="/login">{t.signIn}</Link></p>}
      </div></div>
      <div className="project-work"><TaskPanel closed={closed} key={`tasks-${project.id}`} id={project.id} language={language} /><RoomPanel key={`room-${project.id}`} id={project.id} language={language} /></div>
    </article>}
  </section>;
}
function ProjectForm({ language, project }: { language: Language; project?: Project }) {
  const t = projectCopy[language];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project?.title ?? '');
  const [coverTitle, setCoverTitle] = useState(project?.title ?? '');
  const [error, setError] = useState<'error' | 'invalid' | 'session' | 'forbidden' | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const form = new FormData(event.currentTarget);
    const body = { title: String(form.get('title') ?? '').trim(), goal: String(form.get('goal') ?? '').trim(), description: String(form.get('description') ?? '').trim(),
      techStack: String(form.get('techStack') ?? '').split(',').map(s => s.trim()).filter(Boolean), repositoryUrl: form.get('repositoryUrl') || null, documentationUrl: form.get('documentationUrl') || null,
      privateInstructions: form.get('privateInstructions') ?? '', discordUrl: form.get('discordUrl') || null,
      ...(!project ? { ideaId: params.get('idea') ? Number(params.get('idea')) : null } : {}),
    };
    if (!body.title || !body.goal) { setError('invalid'); return; }
    setBusy(true);
    try {
      const response = await fetch(project ? `/api/projects/${project.id}` : '/api/projects', { method: project ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 401 ? 'session' : response.status === 403 ? 'forbidden' : response.status === 400 ? 'invalid' : 'error'); return; }
      const id = project?.id ?? detailSchema.parse(await response.json()).project.id;
      navigate(`/projects/${id}`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <form className={`account-form idea-form creation-form${project ? '' : ' project-create-form'}`} data-cover-tone={!project ? activityCover('project', coverTitle).tone : undefined} onSubmit={submit} aria-busy={busy}>
    {!project && <div className="project-create-art" aria-hidden="true"><img src={activityCover('project', coverTitle).src} alt="" width="600" height="600" decoding="async" /></div>}
    <label className="creation-title-field">{t.titleField}<input name="title" required maxLength={120} value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} onBlur={()=>setCoverTitle(draftTitle)} placeholder={t.titlePlaceholder} /></label>
    <label><span id="project-goal-label">{project ? t.goal : t.createGoal}</span><textarea aria-labelledby="project-goal-label" name="goal" required maxLength={1000} rows={project ? 2 : 3} defaultValue={project?.goal} placeholder={t.goalPlaceholder} /></label>
    {!project && <p className="field-hint creation-public-hint">{t.shortPublicHint}</p>}
    {project && <><label><span id="project-description-label">{t.description}</span><textarea aria-labelledby="project-description-label" name="description" maxLength={12000} rows={4} defaultValue={project.description} placeholder={t.descriptionPlaceholder} /></label>
    <p className="field-hint creation-public-hint">{t.publicHint}</p>
    <details className="project-form-section creation-disclosure" open={!!(project.techStack.length || project.repositoryUrl || project.documentationUrl)}><summary><span>{t.moreDetails}</span></summary><div className="creation-disclosure-body">
      <label>{t.techStack}<input name="techStack" defaultValue={project?.techStack.join(', ')} aria-describedby="stack-hint" /></label><p className="field-hint" id="stack-hint">{t.stackHint}</p>
      <label>{t.repositoryUrl}<input type="url" name="repositoryUrl" maxLength={2000} defaultValue={project?.repositoryUrl ?? ''} /></label><p className="field-hint">{t.repositoryHint}</p>
      <label>{t.documentationUrl}<input type="url" name="documentationUrl" maxLength={2000} defaultValue={project?.documentationUrl ?? ''} /></label>
    </div></details>
    <details className="project-form-section creation-disclosure" open={!!(project.privateInstructions || project.discordUrl)}><summary><span>{t.membersOnly}</span></summary><div className="creation-disclosure-body"><p className="field-hint">{t.privateHint}</p>
      <label><span id="project-privateInstructions-label">{t.privateInstructions}</span><textarea aria-labelledby="project-privateInstructions-label" name="privateInstructions" maxLength={5000} rows={4} defaultValue={project?.privateInstructions} /></label>
      <label>{t.discordUrl}<input type="url" name="discordUrl" maxLength={2000} defaultValue={project?.discordUrl ?? ''} /></label>
    </div></details></>}
    {error && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <a className="text-link" href="/login" target="_blank" rel="noopener noreferrer">{t.signIn}</a></>}</p>}
    <div className="account-actions"><button className="button-primary" disabled={busy}>{busy ? t.saving : project ? t.save : t.create}</button><Link className="text-link" to={project ? `/projects/${project.id}` : '/projects'}>{t.cancel}</Link></div>
  </form>;
}
function ProjectManagement({ project, language, refresh, closed }: { project: Project; language: Language; refresh: () => void; closed: () => void }) {
  const t = projectCopy[language];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function start() {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/projects/${project.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Cannot start');
      refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(project.status);
  return <div className="management-area"><div className="management-heading"><h2>{language === 'de' ? 'Projekt verwalten' : 'Manage project'}</h2><p>{language === 'de' ? 'Aufgaben, Raum und Verantwortung an einem Ort.' : 'Tasks, room and responsibility in one place.'}</p></div>
    {project.status === 'PLANNING' && <section className="management-action"><h3>{language === 'de' ? 'Projekt starten' : 'Start project'}</h3><p>{language === 'de' ? 'Markiere das Projekt als in Arbeit, wenn ihr loslegt.' : 'Mark the project as in progress when work begins.'}</p><button className="button-primary" disabled={busy} onClick={() => void start()}>{busy ? t.starting : t.start}</button>{error && <p className="form-error" role="alert">{t.error}</p>}</section>}
    <TaskPanel manage id={project.id} language={language} closed={isClosed}/>
    <RoomPanel manage id={project.id} language={language}/>
    {project.owner && <OwnershipPanel id={project.id} language={language} refresh={refresh}/>}
    {project.canClose && <LifecyclePanel id={project.id} language={language} refresh={closed}/>}
  </div>;
}
export function ProjectEditor({ language, edit = false }: { language: Language; edit?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = projectCopy[language];
  const viewer = useResource('/api/me', viewerSchema);
  const resource = useResource(edit ? `/api/projects/${encodeURIComponent(id ?? '')}` : null, detailSchema);
  return <section className={`ideas-page idea-editor${edit ? '' : ' project-create-page'}`}><Link className="text-link back-link" to={edit?`/projects/${id}`:'/projects'}><Icon name="arrow-left" />{edit?(language==='de'?'Zum Projekt':'Back to project'):t.back}</Link><div className="account-heading"><h1>{edit ? t.edit : t.newTitle}</h1>{!edit && <p>{t.ownership}</p>}</div>
    {viewer.loading ? <LoadState language={language} {...viewer} /> : viewer.status === 401 ? <div className="creation-signin"><p>{t.login}</p><Link className="button-primary" to={`/login?next=${encodeURIComponent(edit ? `/projects/${id}/edit` : `/projects/new${location.search}`)}`}>{t.signIn}</Link></div>
      : !viewer.data ? <LoadState language={language} {...viewer} /> : edit && !resource.data ? <LoadState language={language} {...resource} />
      : edit && !resource.data?.project.canEdit ? <p role="alert">{t.forbidden}</p>
      : <><ProjectForm key={resource.data?.project.id ?? 'new'} language={language} project={resource.data?.project} />{edit&&resource.data?.project&&<ProjectManagement project={resource.data.project} language={language} refresh={resource.retry} closed={()=>{resource.retry();navigate(`/projects/${id}`);}}/>}</>}
  </section>;
}
