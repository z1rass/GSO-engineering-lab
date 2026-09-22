import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';
import './styles.css';

const activitySchema = z.object({ id: z.number(), type: z.enum(['PROJECT', 'EVENT']), title: z.string(), status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED']) });
const participationSchema = activitySchema.extend({ isOwner: z.boolean(), joined: z.boolean(), going: z.boolean() });
const taskSchema = z.object({ id: z.number(), title: z.string(), status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']), dueDate: z.string().nullable(), activity: activitySchema });
const schema = z.object({ projects: z.array(participationSchema), events: z.array(participationSchema), tasks: z.array(taskSchema), interested: z.object({ ideas: z.array(z.object({ id: z.number(), title: z.string() })), activities: z.array(activitySchema) }) });
type Activity = z.infer<typeof activitySchema>;
type Participation = z.infer<typeof participationSchema>;
type Task = z.infer<typeof taskSchema>;
const copy = {
  de: { title: 'Meine Aktivitäten', intro: 'Deine Aufgaben, deine Teams und das, was dich interessiert.', profile: 'Profil bearbeiten', tasks: 'Meine Aufgaben', projects: 'Meine Projekte', events: 'Meine Events', interest: 'Interessiert', interestHint: 'Interesse ist keine Zusage: Du bist damit weder im Projektteam noch für ein Event angemeldet.', history: 'Vergangene Aktivitäten und Aufgaben', owner: 'Verantwortlich', joined: 'Im Team', going: 'Angemeldet', emptyTasks: 'Du hast gerade keine Aufgaben übernommen.', emptyProjects: 'Du leitest gerade kein Projekt und bist in keinem aktiven Projektteam.', emptyEvents: 'Du organisierst gerade kein Event und bist für keines angemeldet.', emptyInterest: 'Du hast noch kein Interesse markiert.', discoverProjects: 'Projekte entdecken', discoverEvents: 'Events entdecken', discoverIdeas: 'Ideen entdecken', due: 'Fällig', idea: 'Idee', PROJECT: 'Projekt', EVENT: 'Event', PLANNING: 'In Vorbereitung', ACTIVE: 'Aktiv', COMPLETED: 'Abgeschlossen', CANCELLED: 'Abgesagt', OPEN: 'Offen', IN_PROGRESS: 'In Arbeit', DONE: 'Erledigt', loading: 'Deine Aktivitäten werden geladen …', error: 'Deine Aktivitäten konnten nicht geladen werden.', retry: 'Erneut versuchen', loginHint: 'Melde dich an, um deine Aktivitäten zu sehen.', login: 'Anmelden' },
  en: { title: 'My Activity', intro: 'Your tasks, your teams and the things you are interested in.', profile: 'Edit profile', tasks: 'My tasks', projects: 'My projects', events: 'My events', interest: 'Interested', interestHint: 'Interest is not a commitment: it does not join a project team or register you for an event.', history: 'Past activities and tasks', owner: 'Responsible', joined: 'Team member', going: 'Going', emptyTasks: 'You have no tasks in progress.', emptyProjects: 'You are not leading or taking part in any current projects.', emptyEvents: 'You are not organising or registered for any current events.', emptyInterest: 'You have not marked any interests yet.', discoverProjects: 'Explore projects', discoverEvents: 'Explore events', discoverIdeas: 'Explore ideas', due: 'Due', idea: 'Idea', PROJECT: 'Project', EVENT: 'Event', PLANNING: 'Planning', ACTIVE: 'Active', COMPLETED: 'Completed', CANCELLED: 'Cancelled', OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done', loading: 'Loading your activity …', error: 'Could not load your activity.', retry: 'Try again', loginHint: 'Sign in to see your activity.', login: 'Sign in' },
};
function href(activity: Activity) { return `/${activity.type === 'PROJECT' ? 'projects' : 'events'}/${activity.id}`; }
function current(activity: Activity) { return activity.status === 'PLANNING' || activity.status === 'ACTIVE'; }
function working(task: Task) { return task.status === 'IN_PROGRESS' && current(task.activity); }

function ActivityRows({ items, language }: { items: Participation[]; language: Language }) {
  const t = copy[language];
  return <ul className="my-activity-list">{items.map(item => <li key={item.id}><Link to={href(item)}>
    <h3>{item.title}</h3><div className="my-activity-meta"><span>{t[item.status]}</span>{item.isOwner && <strong>{t.owner}</strong>}{item.joined && <span>{t.joined}</span>}{item.going && <span>{t.going}</span>}</div>
  </Link></li>)}</ul>;
}
function TaskRows({ items, language }: { items: Task[]; language: Language }) {
  const t = copy[language];
  const date = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
  return <ul className="my-activity-list">{items.map(task => <li key={task.id}><Link to={href(task.activity)}>
    <h3>{task.title}</h3><p>{task.activity.title}</p><div className="my-activity-meta"><span>{t[task.status]}</span>{task.dueDate && <span>{t.due}: <time dateTime={task.dueDate}>{date.format(new Date(`${task.dueDate}T00:00:00Z`))}</time></span>}</div>
  </Link></li>)}</ul>;
}

export function MyActivityPage({ language }: { language: Language }) {
  const t = copy[language]; const resource = useResource('/api/me/activity', schema); const data = resource.data;
  const tasks = data?.tasks.filter(working) ?? [];
  const pastTasks = data?.tasks.filter(task => !working(task)) ?? [];
  const projects = data?.projects.filter(current) ?? [];
  const events = data?.events.filter(current) ?? [];
  const pastActivities = [...(data?.projects ?? []), ...(data?.events ?? [])].filter(item => !current(item));
  return <section className="my-activity-page">
    <header className="my-activity-heading"><div><h1>{t.title}</h1><p>{t.intro}</p></div><Link className="text-link" to="/profile">{t.profile}</Link></header>
    {resource.loading ? <p role="status">{t.loading}</p> : !data ? [401, 403].includes(resource.status) ? <div><p>{t.loginHint}</p><Link className="text-link" to="/login">{t.login}</Link></div> : <div><p role="alert">{t.error}</p><button className="text-link" onClick={resource.retry}>{t.retry}</button></div> : <>
      <section className="my-activity-section" aria-labelledby="my-tasks"><h2 id="my-tasks">{t.tasks}</h2>{tasks.length ? <TaskRows items={tasks} language={language} /> : <p className="my-activity-empty">{t.emptyTasks}</p>}</section>
      <div className="my-activity-columns">
        <section className="my-activity-section" aria-labelledby="my-projects"><h2 id="my-projects">{t.projects}</h2>{projects.length ? <ActivityRows items={projects} language={language} /> : <p className="my-activity-empty">{t.emptyProjects}</p>}<Link className="text-link" to="/projects">{t.discoverProjects}</Link></section>
        <section className="my-activity-section" aria-labelledby="my-events"><h2 id="my-events">{t.events}</h2>{events.length ? <ActivityRows items={events} language={language} /> : <p className="my-activity-empty">{t.emptyEvents}</p>}<Link className="text-link" to="/events">{t.discoverEvents}</Link></section>
      </div>
      <section className="my-activity-section" aria-labelledby="my-interest"><h2 id="my-interest">{t.interest}</h2><p className="my-activity-empty">{t.interestHint}</p>
        {!data.interested.ideas.length && !data.interested.activities.length ? <p className="my-activity-empty">{t.emptyInterest}</p> : <ul className="my-activity-list">
          {data.interested.ideas.map(idea => <li key={`idea-${idea.id}`}><Link to={`/ideas/${idea.id}`}><h3>{idea.title}</h3><p>{t.idea}</p></Link></li>)}
          {data.interested.activities.map(item => <li key={item.id}><Link to={href(item)}><h3>{item.title}</h3><p>{t[item.type]} · {t[item.status]}</p></Link></li>)}
        </ul>}<Link className="text-link" to="/ideas">{t.discoverIdeas}</Link>
      </section>
      {(pastActivities.length > 0 || pastTasks.length > 0) && <details className="my-activity-history"><summary>{t.history}</summary><ActivityRows items={pastActivities} language={language} /><TaskRows items={pastTasks} language={language} /></details>}
    </>}
  </section>;
}
