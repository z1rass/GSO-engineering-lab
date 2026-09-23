import {useId,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {z} from 'zod';
import type {Language} from '../i18n';
import {useResource} from '../shared/use-resource';
import {roomCopy} from './copy';
const roomSchema=z.object({id:z.number().optional(),activityId:z.number().optional(),status:z.enum(['PENDING','ALTERNATIVE','CONFIRMED']),note:z.string().optional(),date:z.string().nullable().optional(),endDate:z.string().nullable().optional(),startTime:z.string().nullable().optional(),endTime:z.string().nullable().optional(),room:z.string().nullable().optional(),message:z.string().nullable().optional()});
const detailSchema=z.object({request:roomSchema.nullable(),canRequest:z.boolean().optional(),canRespond:z.boolean().optional(),canAccept:z.boolean().optional(),offerAccepted:z.boolean().optional()});
const queueSchema=z.object({requests:z.array(roomSchema.extend({id:z.number(),activityId:z.number(),title:z.string(),type:z.enum(['EVENT','PROJECT'])}))});
type Room=z.infer<typeof roomSchema>;
function RoomDetails({room,language,offerAccepted=false}:{room:Room;language:Language;offerAccepted?:boolean}){
 const t=roomCopy[language];
 return <><p className="status">{t[room.status]}</p>{room.note!==undefined&&(room.note?<p className="idea-description">{room.note}</p>:<p className="ideas-note">{t.automaticRequest}</p>)}
  {room.date&&<p className="room-slot">{room.date}{room.endDate&&` – ${room.endDate}`} · {room.startTime} – {room.endTime}<br/>{room.room}<br/><small>{t.timezone}</small></p>}
  {room.message&&<p className="idea-description">{room.message}</p>}
  {room.status==='ALTERNATIVE'&&<p className="ideas-note">{offerAccepted?t.awaitingConfirmation:t.alternative}</p>}
  {room.status==='CONFIRMED'&&room.date&&<p className="ideas-note">{t.independent}</p>}</>;
}
function useRoomWrite(done:()=>void){
 const [busy,setBusy]=useState(false);const [error,setError]=useState<'error'|'invalid'|'denied'|'conflict'|null>(null);
 async function save(path:string,body:unknown,method='POST'){
  setBusy(true);setError(null);
  try{const result=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!result.ok){setError(result.status===400?'invalid':result.status===409?'conflict':[401,403].includes(result.status)?'denied':'error');return;}
   done();
  }catch{setError('error');}finally{setBusy(false);}
 }
 return {busy,error,save};
}
function Feedback({error,language,retry}:{error:'error'|'invalid'|'denied'|'conflict'|null;language:Language;retry:()=>void}){
 const t=roomCopy[language];return error&&<p role="alert" className="form-error">{t[error]} {error==='conflict'&&<button type="button" className="text-link" onClick={retry}>{t.retry}</button>}{error==='denied'&&<Link className="text-link" to="/login">{t.login}</Link>}</p>;
}
function RequestForm({id,language,done}:{id:number;language:Language;done:()=>void}){
 const t=roomCopy[language];const state=useRoomWrite(done);const label=useId();
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();void state.save(`/api/activities/${id}/room-request`,{note:String(new FormData(e.currentTarget).get('note'))});}
 return <form className="account-form idea-form" onSubmit={submit} aria-busy={state.busy}><label><span id={label}>{t.note}</span><textarea aria-labelledby={label} name="note" required maxLength={3000} rows={3}/></label><p className="field-hint">{t.hint}</p><Feedback error={state.error} language={language} retry={done}/><button className="button-primary" disabled={state.busy}>{state.busy?t.saving:t.request}</button></form>;
}
export function RoomPanel({id,language,onRequested,scheduleNeeded=false,manage=false}:{id:number;language:Language;onRequested?:()=>void;scheduleNeeded?:boolean;manage?:boolean}){
 const t=roomCopy[language];const resource=useResource(`/api/activities/${id}/room-request`,detailSchema);
 const acceptance=useRoomWrite(()=>{resource.retry();onRequested?.();});
 if(!manage&&!resource.data?.request)return null;
 return <section className="project-room" aria-label={t.title}><h2>{t.title}</h2>
  {!resource.data?resource.loading?<p role="status">{t.loading}</p>:<p role="alert">{t.error} <button className="text-link" onClick={resource.retry}>{t.retry}</button></p>
   :<>{resource.data.request?<RoomDetails room={resource.data.request} language={language} offerAccepted={resource.data.offerAccepted}/>:scheduleNeeded?<p className="ideas-note">{t.scheduleNeeded}</p>:manage&&resource.data.canRequest?<RequestForm id={id} language={language} done={()=>{resource.retry();onRequested?.();}}/>:<p className="ideas-note">{t.none}</p>}
    {manage&&resource.data.canAccept&&<><button className="button-primary" disabled={acceptance.busy} onClick={()=>void acceptance.save(`/api/activities/${id}/room-request/accept`,{})}>{acceptance.busy?t.saving:t.acceptAlternative}</button><Feedback error={acceptance.error} language={language} retry={resource.retry}/></>}
    {manage&&resource.data.canRespond&&resource.data.request&&<Link className="text-link" to="/ops/rooms">{t.queue} ↗</Link>}</>}
 </section>;
}
function AnswerForm({room,language,done}:{room:Room&{id:number};language:Language;done:()=>void}){
 const t=roomCopy[language];const state=useRoomWrite(done);const [agreed,setAgreed]=useState(false);const label=useId();
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;const status=submitter?.value;if(status!=='ALTERNATIVE'&&status!=='CONFIRMED')return;if(status==='CONFIRMED'&&!agreed)return;
  void state.save(`/api/ops/room-requests/${room.id}`,{status,date:form.get('date'),endDate:form.get('endDate')||null,startTime:form.get('startTime'),endTime:form.get('endTime'),room:form.get('room'),message:form.get('message')},'PATCH');}
 return <form className="account-form idea-form" onSubmit={submit} aria-busy={state.busy}><p className="field-hint">{t.timezone}</p><div className="event-form-grid">
  <label>{t.date}<input name="date" type="date" required defaultValue={room.date??''}/></label><label>{t.endDate}<input name="endDate" type="date" defaultValue={room.endDate??''}/></label>
  <label>{t.start}<input name="startTime" type="time" required defaultValue={room.startTime??''}/></label><label>{t.end}<input name="endTime" type="time" required defaultValue={room.endTime??''}/></label></div>
  <label>{t.room}<input name="room" required maxLength={300} defaultValue={room.room??''}/></label>
  <label><span id={label}>{t.message}</span><textarea aria-labelledby={label} name="message" maxLength={3000} rows={3} defaultValue={room.message??''}/></label>
  <label className="room-agreement"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>{t.agreed}</label><p className="field-hint">{t.final}</p>
  <Feedback error={state.error} language={language} retry={done}/><div className="account-actions"><button className="text-link" value="ALTERNATIVE" disabled={state.busy}>{t.offer}</button><button className="button-primary" value="CONFIRMED" disabled={state.busy||!agreed}>{state.busy?t.saving:t.confirm}</button></div></form>;
}
export function RoomQueue({language}:{language:Language}){
 const t=roomCopy[language];const resource=useResource('/api/ops/room-requests',queueSchema);
 return <section className="ideas-page idea-editor"><Link className="text-link" to="/ops">← {t.back}</Link><div className="account-heading"><h1>{t.queue}</h1></div>
  {!resource.data?resource.loading?<p role="status">{t.loading}</p>:[401,403].includes(resource.status)?<p role="alert">{t.noAccess} <Link to="/login">{t.login}</Link></p>:<p role="alert">{t.error} <button className="text-link" onClick={resource.retry}>{t.retry}</button></p>
  :!resource.data.requests.length?<p>{t.empty}</p>:resource.data.requests.map(room=><article className="room-request" key={room.id}><h2><Link to={`/${room.type==='EVENT'?'events':'projects'}/${room.activityId}`}>{room.title}</Link></h2><RoomDetails room={room} language={language}/>{room.status!=='CONFIRMED'&&<AnswerForm room={room} language={language} done={resource.retry}/>}</article>)}
 </section>;
}
