import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';

const schema = z.object({ count: z.number().int().nonnegative(), joined: z.boolean().optional(), isOwner: z.boolean().optional(), canJoin: z.boolean().optional(), members: z.array(z.object({id:z.string(),name:z.string()})).optional() });
const copy = {
  de: { title:'Team', join:'Projekt beitreten', leave:'Team verlassen', hint:'Mach im Projekt mit. Dein Interesse bleibt davon unabhängig.', owner:'Du bist Owner dieses Projekts. Übertrage die Verantwortung, bevor du gehst.', closed:'Dieses Projekt nimmt keine neuen Mitglieder auf.', login:'Anmelden, um das Team zu sehen und mitzumachen', loading:'Team wird geladen …', saving:'Wird gespeichert …', error:'Die Änderung konnte nicht bestätigt werden. Bitte versuche es erneut.', loadError:'Das Team konnte nicht geladen werden.', conflict:'Das Projekt oder deine Verantwortung hat sich geändert. Lade das Team erneut.', retry:'Team neu laden', session:'Bitte melde dich erneut an.', signIn:'Anmelden', count:(n:number)=>`${n} im Team` },
  en: { title:'Team', join:'Join project', leave:'Leave team', hint:'Take part in the project. Your interest stays separate.', owner:'You own this project. Transfer responsibility before leaving.', closed:'This project is not accepting new members.', login:'Sign in to see the team and take part', loading:'Loading team …', saving:'Saving …', error:'Could not confirm the change. Please try again.', loadError:'Could not load the team.', conflict:'The project or your responsibility has changed. Reload the team.', retry:'Reload team', session:'Please sign in again.', signIn:'Sign in', count:(n:number)=>`${n} in the team` },
};
export function ProjectTeam({ id, language }: {id:number;language:Language}) {
  const path = `/api/projects/${id}/membership`;
  const resource = useResource(path,schema);
  const [saved,setSaved] = useState<z.infer<typeof schema>|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<'error'|'session'|'conflict'|null>(null);
  const data = saved ?? resource.data;
  const t = copy[language];
  function reload() { setSaved(null); setError(null); resource.retry(); }
  async function change() {
    if (!data || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(path,{method:data.joined?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
      if (response.status===401) { setError('session'); setSaved({count:data.count}); return; }
      if (response.status===409) { setError('conflict'); return; }
      if (!response.ok) throw new Error('Membership write failed');
      const fresh = await fetch(path,{signal:AbortSignal.timeout(10000)});
      if (!fresh.ok) throw new Error('Membership read failed');
      setSaved(schema.parse(await fresh.json()));
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <section className="project-team" aria-label={t.title} aria-busy={resource.loading||busy}>
    <h2>{t.title}</h2>
    {!data ? resource.loading ? <p role="status">{t.loading}</p> : <p role="alert">{t.loadError} <button className="text-link" onClick={reload}>{t.retry}</button></p>
      : <><div className="interested-row"><p role="status" aria-live="polite" aria-atomic="true">{t.count(data.count)}</p>
        {!data.members ? <Link className="text-link" to="/login">{t.login} ↗</Link>
          : data.joined ? !data.isOwner && <button className="text-link" disabled={busy} onClick={()=>void change()}>{busy?t.saving:t.leave}</button>
          : data.canJoin && <button className="button-primary" disabled={busy} onClick={()=>void change()}>{busy?t.saving:t.join}</button>}
      </div>
      {data.members && <><p className="field-hint">{t.hint}</p>{data.isOwner && <p className="ideas-note">{t.owner}</p>}{!data.canJoin && <p className="ideas-note">{t.closed}</p>}
        {!!data.members.length && <ul className="team-list">{data.members.map(member=><li key={member.id}>{member.name}</li>)}</ul>}</>}
      </>}
    {error && <p className="form-error" role="alert">{t[error]} {error==='session'?<Link className="text-link" to="/login">{t.signIn}</Link>:<button className="text-link" onClick={reload} disabled={busy}>{t.retry}</button>}</p>}
  </section>;
}
