import {useState} from 'react';
import {z} from 'zod';
import type {Language} from '../i18n';
import {useResource} from '../shared/use-resource';
const schema=z.object({tasks:z.array(z.object({status:z.string()}))});
const copy={
 de:{title:'Activity abschließen',complete:'Als abgeschlossen markieren',cancel:'Activity absagen',confirmComplete:'Abschluss bestätigen',confirmCancel:'Absage bestätigen',back:'Zurück',hint:'Die Seite und ihre Ergebnisse bleiben erhalten. Wenn du ohne Nachfolge gehst, sage die Activity ab. Informiere Beteiligte über Discord.',warning:(n:number)=>`${n} offene oder laufende Aufgaben werden abgesagt.`,ack:'Alle verbleibenden Aufgaben absagen',loading:'Aufgaben werden geprüft …',busy:'Wird gespeichert …',error:'Der Abschluss konnte nicht bestätigt werden. Lade die Seite neu und prüfe den Status.',retry:'Neu laden'},
 en:{title:'Close activity',complete:'Mark as completed',cancel:'Cancel activity',confirmComplete:'Confirm completion',confirmCancel:'Confirm cancellation',back:'Back',hint:'The page and its results remain available. If you leave without a successor, cancel the activity. Tell participants through Discord.',warning:(n:number)=>`${n} open or in-progress tasks will be cancelled.`,ack:'Cancel all remaining tasks',loading:'Checking tasks …',busy:'Saving …',error:'Could not confirm closure. Reload the page and check its status.',retry:'Reload'},
};
export function LifecyclePanel({id,language,refresh}:{id:number;language:Language;refresh:()=>void}){
 const t=copy[language];const resource=useResource(`/api/activities/${id}/tasks`,schema);
 const [outcome,setOutcome]=useState<'COMPLETED'|'CANCELLED'|null>(null);const [confirmed,setConfirmed]=useState(false);const [changedCount,setChangedCount]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 const count=changedCount??resource.data?.tasks.filter(task=>['OPEN','IN_PROGRESS'].includes(task.status)).length??0;
 async function close(){
  setBusy(true);setError(false);try{
   const result=await fetch(`/api/activities/${id}/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:outcome,confirmUnfinished:confirmed}),signal:AbortSignal.timeout(10000)});
   if(!result.ok){const body=await result.json();if(body.error==='CONFIRM_UNFINISHED_TASKS'){setChangedCount(body.unfinishedCount);setConfirmed(false);}else setError(true);return;}
   refresh();
  }catch{setError(true);}finally{setBusy(false);}
 }
 return <details className="project-form-section lifecycle-panel"><summary>{t.title}</summary><p className="ideas-note">{t.hint}</p>
  {!resource.data?<p role={resource.loading?'status':'alert'}>{resource.loading?t.loading:t.error} {!resource.loading&&<button className="text-link" onClick={resource.retry}>{t.retry}</button>}</p>
   :!outcome?<div className="account-actions"><button className="text-link" onClick={()=>setOutcome('COMPLETED')}>{t.complete}</button><button className="text-link" onClick={()=>setOutcome('CANCELLED')}>{t.cancel}</button></div>
   :<div className="closure-confirmation">{count>0&&<><p role="alert">{t.warning(count)}</p><label className="closure-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>{t.ack}</label></>}
    <div className="account-actions"><button className="button-primary" disabled={busy||(count>0&&!confirmed)} onClick={()=>void close()}>{busy?t.busy:outcome==='COMPLETED'?t.confirmComplete:t.confirmCancel}</button><button className="text-link" disabled={busy} onClick={()=>{setOutcome(null);setConfirmed(false);}}>{t.back}</button></div>
   </div>}
  {error&&<p role="alert" className="form-error">{t.error} <button className="text-link" onClick={refresh}>{t.retry}</button></p>}
 </details>;
}
