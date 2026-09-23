import {useState} from 'react';
import {Link} from 'react-router-dom';
import {z} from 'zod';
import type {Language} from '../i18n';
import {useResource} from '../shared/use-resource';
const schema=z.object({open:z.boolean(),count:z.number(),going:z.boolean().optional(),isOwner:z.boolean().optional(),canOpen:z.boolean().optional(),participants:z.array(z.object({id:z.string(),name:z.string()})).optional()});
const copy={
 de:{title:'Teilnehmen',open:'Anmeldung öffnen',join:'Ich bin dabei',joined:'Du bist für diesen Termin angemeldet.',leave:'Anmeldung zurückziehen',closed:'Die Anmeldung ist noch geschlossen. Du kannst Interesse zeigen.',ready:'Zum Öffnen braucht es Datum, Beginn, Ende und Ort. Falls ein Schulraum benötigt oder angefragt wurde, müssen Termin und genaue Raumnummer zur bestätigten Raumzusage passen.',login:'Anmelden, um teilzunehmen',loading:'Anmeldung wird geladen …',saving:'Wird gespeichert …',error:'Das hat nicht geklappt. Bitte lade die Anmeldung erneut.',conflict:'Die Bedingungen sind noch nicht bereit oder haben sich geändert. Lade die Seite erneut und prüfe Termin und Raum.',denied:'Bitte melde dich an. Nur der Owner kann die Anmeldung öffnen.',retry:'Neu laden',count:(n:number)=>`${n} angemeldet`,notice:'Eine Anmeldung gilt für den aktuellen Termin. Änderungen teilt der Owner über Discord mit.'},
 en:{title:'Take part',open:'Open registration',join:'I’m going',joined:'You are registered for this schedule.',leave:'Withdraw registration',closed:'Registration is not open yet. You can show interest.',ready:'Opening requires a date, start, end and venue. If a school room is required or requested, the schedule and exact room must match the confirmed booking.',login:'Sign in to take part',loading:'Loading registration …',saving:'Saving …',error:'Something went wrong. Please reload registration.',conflict:'Conditions are incomplete or have changed. Reload the page and check the schedule and room.',denied:'Please sign in. Only the owner can open registration.',retry:'Reload',count:(n:number)=>`${n} going`,notice:'Registration is for the current schedule. The owner shares changes through Discord.'},
};
export function EventGoing({id,language,refresh,closed=false,manage=false}:{id:number;language:Language;refresh:()=>void;closed?:boolean;manage?:boolean}){
 const resource=useResource(`/api/events/${id}/going`,schema);const t=copy[language];const data=resource.data;
 const [busy,setBusy]=useState(false);const [error,setError]=useState<'error'|'conflict'|'denied'|null>(null);
 async function act(action:'open'|'join'|'leave'){
  setBusy(true);setError(null);
  try{const result=await fetch(`/api/events/${id}/${action==='open'?'open':'going'}`,{method:action==='leave'?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
   if(!result.ok){setError(result.status===409?'conflict':[401,403].includes(result.status)?'denied':'error');return;}
   if(action==='open')refresh();else resource.retry();
  }catch{setError('error');}finally{setBusy(false);}
 }
 if (!manage && !closed && !data?.open) return null;
 return <section className="project-team" aria-label={closed?(language==='de'?'Teilnehmende':'Participants'):t.title} aria-busy={busy||resource.loading}><h2>{closed?(language==='de'?'Teilnehmende':'Participants'):t.title}</h2>
  {!data?resource.loading?<p role="status">{t.loading}</p>:<p role="alert">{t.error} <button className="text-link" onClick={resource.retry}>{t.retry}</button></p>
  :<><p role="status" aria-live="polite" aria-atomic="true">{t.count(data.count)}</p>{!closed&&<p className="field-hint">{t.notice}</p>}
   {!closed&&!data.open&&<p className="ideas-note">{t.closed}</p>}
   {!manage&&!closed&&(data.going?<><p className="participation-state">{t.joined}</p><button className="text-link" disabled={busy} onClick={()=>void act('leave')}>{busy?t.saving:t.leave}</button></>:data.open&&(data.going===undefined?<Link className="text-link" to="/login">{t.login}</Link>:<button className="button-primary" disabled={busy} onClick={()=>void act('join')}>{busy?t.saving:t.join}</button>))}
   {manage&&!closed&&data.isOwner&&!data.open&&<><p className="ideas-note">{t.ready}</p><button className="button-primary" disabled={busy||!data.canOpen} onClick={()=>void act('open')}>{busy?t.saving:t.open}</button></>}
   {!!data.participants?.length&&<ul className="team-list">{data.participants.map(person=><li key={person.id}>{person.name}</li>)}</ul>}
  </>}
  {error&&<p role="alert" className="form-error">{t[error]} <button className="text-link" onClick={refresh}>{t.retry}</button></p>}
 </section>;
}
