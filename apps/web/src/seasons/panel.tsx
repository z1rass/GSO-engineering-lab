import {useId,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {z} from 'zod';
import type {Language} from '../i18n';
import {useResource} from '../shared/use-resource';
import {copy,LoadState} from './shared';
const summary=z.object({id:z.number(),number:z.number(),title:z.string(),status:z.string()});
const schema=z.object({seasons:z.array(summary),canAttach:z.boolean().optional(),candidates:z.array(summary).optional()});
export function ActivitySeasons({id,language,project=false}:{id:number;language:Language;project?:boolean}){
 const t=copy[language];const label=useId();const resource=useResource(`/api/activities/${id}/seasons`,schema);const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setError(false);try{const response=await fetch(`/api/activities/${id}/seasons`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seasonId:Number(form.get('seasonId'))}),signal:AbortSignal.timeout(10000)});if(!response.ok){setError(true);return;}resource.retry();}catch{setError(true);}finally{setBusy(false);}}
 return <section className="activity-seasons" aria-label={t.history}>{!resource.data?<LoadState {...resource} language={language}/>:<><div className="season-history">{resource.data.seasons.map(season=><Link className="season-badge" key={season.id} to={`/seasons/${season.id}`}>Season {season.number}</Link>)}</div>{resource.data.canAttach&&<>{!resource.data.seasons.length&&<p className="ideas-note">{t.independent}</p>}{!!resource.data.candidates?.length&&<form className="account-form season-attach" onSubmit={submit} aria-busy={busy}>{project&&<p className="ideas-note">{t.continue}</p>}<label><span id={label}>{t.choose}</span><select name="seasonId" aria-labelledby={label} required defaultValue=""><option value="" disabled>{t.choose}</option>{resource.data.candidates.map(s=><option key={s.id} value={s.id}>Season {s.number} · {s.title}</option>)}</select></label><button className="text-link" disabled={busy}>{busy?t.saving:t.attach}</button></form>}</>}</>}{error&&<p role="alert" className="form-error">{t.unavailable} <button className="text-link" onClick={()=>{setError(false);resource.retry();}}>{t.retry}</button></p>}</section>;
}
