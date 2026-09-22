import {useId,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {z} from 'zod';
import type {Language} from '../i18n';
import {useResource} from '../shared/use-resource';
const taskSchema=z.object({id:z.number(),title:z.string(),description:z.string(),dueDate:z.string().nullable(),status:z.enum(['OPEN','IN_PROGRESS','DONE','CANCELLED']),owner:z.object({id:z.string(),name:z.string()}).nullable().optional(),canTake:z.boolean().optional(),canComplete:z.boolean().optional(),canEdit:z.boolean().optional(),canCancel:z.boolean().optional()});
const schema=z.object({tasks:z.array(taskSchema),canCreate:z.boolean().optional()});
type Task=z.infer<typeof taskSchema>;
const copy={
 de:{title:'Aufgaben',create:'Aufgabe erstellen',edit:'Aufgabe bearbeiten',titleField:'Aufgabentitel',description:'Aufgabenbeschreibung',due:'Fällig am (optional)',save:'Aufgabe speichern',take:'Aufgabe übernehmen',complete:'Erledigt markieren',release:'Freigeben',cancel:'Aufgabe absagen',OPEN:'Offen',IN_PROGRESS:'In Arbeit',DONE:'Erledigt',CANCELLED:'Abgesagt',owner:'Verantwortlich',empty:'Noch keine Aufgaben.',hint:'Eine Aufgabe übernehmen heißt, direkt loszulegen. Du trittst damit weder dem Projekt bei noch meldest du dich zum Event an.',login:'Anmelden, um zu helfen',loading:'Aufgaben werden geladen …',busy:'Wird gespeichert …',error:'Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.',conflict:'Die Aufgabe ist nicht mehr verfügbar oder ihr Status hat sich geändert. Lade die Aufgaben neu.',denied:'Dafür fehlen dir die Rechte. Melde dich gegebenenfalls erneut an.',invalid:'Prüfe Titel, Textlänge und Datum.',retry:'Aufgaben neu laden'},
 en:{title:'Tasks',create:'Create task',edit:'Edit task',titleField:'Task title',description:'Task description',due:'Due date (optional)',save:'Save task',take:'Take task',complete:'Mark done',release:'Release',cancel:'Cancel task',OPEN:'Open',IN_PROGRESS:'In progress',DONE:'Done',CANCELLED:'Cancelled',owner:'Responsible',empty:'No tasks yet.',hint:'Taking a task means starting work. It does not join the project or register you for the event.',login:'Sign in to help',loading:'Loading tasks …',busy:'Saving …',error:'Could not confirm the change. Please try again.',conflict:'The task is unavailable or its status has changed. Reload the tasks.',denied:'You do not have permission. Sign in again if needed.',invalid:'Check the title, text length and date.',retry:'Reload tasks'},
};
function useTaskWrite(done:()=>void){
 const [busy,setBusy]=useState(false);const [error,setError]=useState<'error'|'conflict'|'denied'|'invalid'|null>(null);
 async function save(path:string,body:unknown={},method='POST'){
  setBusy(true);setError(null);try{const result=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
   if(!result.ok){setError(result.status===409?'conflict':[401,403].includes(result.status)?'denied':result.status===400?'invalid':'error');return;}done();
  }catch{setError('error');}finally{setBusy(false);}
 }return {busy,error,save};
}
function TaskForm({id,task,language,done}:{id:number;task?:Task;language:Language;done:()=>void}){
 const t=copy[language];const state=useTaskWrite(done);const label=useId();
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);void state.save(task?`/api/tasks/${task.id}`:`/api/activities/${id}/tasks`,{title:form.get('title'),description:form.get('description'),dueDate:form.get('dueDate')||null},task?'PATCH':'POST');}
 return <form className="account-form idea-form" onSubmit={submit} aria-busy={state.busy}>
  <label>{t.titleField}<input name="title" required maxLength={120} defaultValue={task?.title}/></label>
  <label><span id={label}>{t.description}</span><textarea name="description" aria-labelledby={label} maxLength={5000} rows={3} defaultValue={task?.description}/></label>
  <label>{t.due}<input name="dueDate" type="date" defaultValue={task?.dueDate??''}/></label>
  {state.error&&<p role="alert" className="form-error">{t[state.error]} <button type="button" className="text-link" onClick={done}>{t.retry}</button></p>}
  <button className="button-primary" disabled={state.busy}>{state.busy?t.busy:t.save}</button>
 </form>;
}
function TaskCard({task,id,language,done}:{task:Task;id:number;language:Language;done:()=>void}){
 const t=copy[language];const state=useTaskWrite(done);
 return <article className="task-card" aria-label={task.title}><span className="status">{t[task.status]}</span><h3>{task.title}</h3>
  {task.description&&<p className="idea-description">{task.description}</p>}{task.dueDate&&<p className="field-hint"><time dateTime={task.dueDate}>{new Intl.DateTimeFormat(language==='de'?'de-DE':'en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${task.dueDate}T00:00:00Z`))}</time></p>}
  {task.owner&&<p className="project-owner">{t.owner}: <strong>{task.owner.name}</strong></p>}
  <div className="account-actions">{task.canTake&&<button className="button-primary" disabled={state.busy} onClick={()=>void state.save(`/api/tasks/${task.id}/take`)}>{t.take}</button>}
   {task.canComplete&&<><button className="button-primary" disabled={state.busy} onClick={()=>void state.save(`/api/tasks/${task.id}/complete`)}>{t.complete}</button><button className="text-link" disabled={state.busy} onClick={()=>void state.save(`/api/tasks/${task.id}/release`)}>{t.release}</button></>}
   {task.canCancel&&<button className="text-link" disabled={state.busy} onClick={()=>void state.save(`/api/tasks/${task.id}/cancel`)}>{t.cancel}</button>}
  </div>{state.busy&&<p role="status">{t.busy}</p>}
  {state.error&&<p role="alert" className="form-error">{t[state.error]} <button className="text-link" onClick={done}>{t.retry}</button></p>}
  {task.canEdit&&<details className="project-form-section"><summary>{t.edit}</summary><TaskForm id={id} task={task} language={language} done={done}/></details>}
 </article>;
}
export function TaskPanel({id,language,closed=false}:{id:number;language:Language;closed?:boolean}){
 const t=copy[language];const resource=useResource(`/api/activities/${id}/tasks`,schema);
 return <section className="task-panel" aria-label={t.title}><h2>{t.title}</h2>{!closed&&<p className="ideas-note">{t.hint}</p>}
  {!resource.data?resource.loading?<p role="status">{t.loading}</p>:<p role="alert">{t.error} <button className="text-link" onClick={resource.retry}>{t.retry}</button></p>
   :<>{resource.data.canCreate&&<details className="project-form-section"><summary>{t.create}</summary><TaskForm id={id} language={language} done={resource.retry}/></details>}
    {!closed&&resource.data.canCreate===undefined&&<Link className="text-link" to="/login">{t.login} ↗</Link>}
    {!resource.data.tasks.length?<p>{t.empty}</p>:resource.data.tasks.map(task=><TaskCard key={task.id} task={task} id={id} language={language} done={resource.retry}/>)}
   </>}
 </section>;
}
