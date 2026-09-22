import {useId,useState,type FormEvent} from 'react';
import {z} from 'zod';
import type {Language} from '../i18n';
import {useResource} from '../shared/use-resource';
const person=z.object({id:z.string(),name:z.string()});
const schema=z.object({canPropose:z.boolean(),candidates:z.array(person.extend({education:z.string().nullable(),year:z.number().nullable()})),pending:z.object({id:z.number(),recipient:person,fromOwner:person,canAccept:z.boolean(),canCancel:z.boolean()}).nullable()});
const copy={
 de:{title:'Verantwortung übertragen',recipient:'Neuer Owner',choose:'Person auswählen',propose:'Übergabe vorschlagen',hint:'Du bleibst verantwortlich, bis die andere Person annimmt. Teile den Link zur Activity über Discord.',waiting:'Wartet auf Annahme',accept:'Verantwortung übernehmen',cancel:'Übergabe abbrechen',from:'Bisheriger Owner',to:'Vorgeschlagener Owner',acceptHint:'Mit der Annahme übernimmst du die Verantwortung für diese Activity. Teammitgliedschaft und Aufgaben bleiben unverändert.',empty:'Noch keine anderen Members verfügbar.',loading:'Übergabe wird geladen …',busy:'Wird gespeichert …',error:'Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.',conflict:'Die Übergabe ist nicht mehr verfügbar. Lade die Seite neu.',denied:'Du kannst diese Übergabe nicht ändern. Prüfe deine Anmeldung.',invalid:'Wähle einen aktuellen Member aus.',retry:'Neu laden'},
 en:{title:'Transfer ownership',recipient:'New owner',choose:'Choose a person',propose:'Propose transfer',hint:'You remain responsible until the other person accepts. Share the activity link through Discord.',waiting:'Waiting for acceptance',accept:'Accept ownership',cancel:'Cancel transfer',from:'Current owner',to:'Proposed owner',acceptHint:'By accepting, you take responsibility for this activity. Team membership and tasks stay unchanged.',empty:'No other Members available yet.',loading:'Loading transfer …',busy:'Saving …',error:'Could not confirm the change. Please try again.',conflict:'This transfer is no longer available. Reload the page.',denied:'You cannot change this transfer. Check your sign-in.',invalid:'Choose a current Member.',retry:'Reload'},
};
export function OwnershipPanel({id,language,refresh}:{id:number;language:Language;refresh:()=>void}){
 const recipientLabel=useId();
 const resource=useResource(`/api/activities/${id}/ownership`,schema);const t=copy[language];
 const [busy,setBusy]=useState(false);const [error,setError]=useState<'error'|'conflict'|'denied'|'invalid'|null>(null);
 async function save(action:string,body:unknown){
  setBusy(true);setError(null);try{
   const response=await fetch(`/api/activities/${id}/ownership${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
   if(!response.ok){setError(response.status===409?'conflict':[401,403].includes(response.status)?'denied':response.status===400?'invalid':'error');return;}
   refresh();
  }catch{setError('error');}finally{setBusy(false);}
 }
 function propose(e:FormEvent<HTMLFormElement>){e.preventDefault();void save('',{recipientId:new FormData(e.currentTarget).get('recipient')});}
 const data=resource.data;
 if(!data)return <p role={resource.loading?'status':'alert'}>{resource.loading?t.loading:t.error} {!resource.loading&&<button className="text-link" onClick={resource.retry}>{t.retry}</button>}</p>;
 if(!data.pending&&!data.canPropose)return null;
 const pending=data.pending;
 return <section className="ownership-panel" aria-label={t.title}>
  {pending?<><h2>{t.waiting}</h2><p>{t.from}: <strong>{pending.fromOwner.name}</strong><br/>{t.to}: <strong>{pending.recipient.name}</strong></p>
   <p className="ideas-note">{pending.canAccept?t.acceptHint:t.hint}</p>
   <div className="account-actions">{pending.canAccept&&<button className="button-primary" disabled={busy} onClick={()=>void save('/accept',{transferId:pending.id})}>{t.accept}</button>}
   {pending.canCancel&&<button className="text-link" disabled={busy} onClick={()=>void save('/cancel',{transferId:pending.id})}>{t.cancel}</button>}</div>
  </>:<details className="project-form-section"><summary>{t.title}</summary><p className="ideas-note">{t.hint}</p>
   {!data.candidates.length?<p>{t.empty}</p>:<form className="account-form" onSubmit={propose} aria-busy={busy}><label><span id={recipientLabel}>{t.recipient}</span><select aria-labelledby={recipientLabel} name="recipient" required defaultValue=""><option value="" disabled>{t.choose}</option>{data.candidates.map(member=><option key={member.id} value={member.id}>{member.name}{member.education?` · ${member.education}`:''}{member.year?` · ${member.year}`:''}</option>)}</select></label><button className="button-primary" disabled={busy}>{t.propose}</button></form>}
  </details>}
  {busy&&<p role="status">{t.busy}</p>}{error&&<p role="alert" className="form-error">{t[error]} <button className="text-link" onClick={refresh}>{t.retry}</button></p>}
 </section>;
}
