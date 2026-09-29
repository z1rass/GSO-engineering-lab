import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../shared/icon';
import type { Idea } from './data';

type Language = 'de' | 'en';

export function VoteButton({ idea, language }: { idea: Idea; language: Language }) {
  const [voted, setVoted] = useState(idea.voted);
  const [count, setCount] = useState(idea.voteCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function vote() {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/ideas/${idea.id}/vote`, { method: voted ? 'DELETE' : 'POST', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Vote failed');
      const result = await response.json() as { voted: boolean; voteCount: number };
      setVoted(result.voted); setCount(result.voteCount);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <div className="idea-vote-wrap"><button className="idea-vote" type="button" aria-pressed={voted} disabled={busy} onClick={() => void vote()}><Icon name="spark" size={17} />{voted ? language === 'de' ? 'Stimme entfernen' : 'Remove vote' : language === 'de' ? 'Stimme geben' : 'Vote'} <span>{count}</span></button>{error && <small role="alert">{language === 'de' ? 'Stimme konnte nicht gespeichert werden. Bitte erneut versuchen.' : 'Could not save your vote. Please try again.'}</small>}</div>;
}

export function NewIdea({ language }: { language: Language }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const de = language === 'de';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: String(values.get('title') ?? '').trim(), description: String(values.get('description') ?? '').trim() }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 429 ? de ? 'Zu viele Ideen in kurzer Zeit. Bitte später erneut versuchen.' : 'Too many ideas in a short time. Please try again later.' : de ? 'Idee konnte nicht gespeichert werden. Bitte prüfe deine Eingaben.' : 'Could not save the idea. Please check your entries.'); return; }
      const result = await response.json() as { idea: { id: number } };
      navigate(`/ideas/${result.idea.id}`);
    } catch { setError(de ? 'Keine Verbindung. Bitte erneut versuchen.' : 'Connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="public-idea-page"><Link className="story-back" to="/ideas"><Icon name="arrow-left" size={17} />{de ? 'Alle Ideen' : 'All ideas'}</Link><div className="public-idea-panel"><h1>{de ? 'Deine Idee teilen' : 'Share your idea'}</h1><p>{de ? 'Was würdest du gerne im Lab sehen? Jede Idee ist willkommen.' : 'What would you like to see in the Lab? Every idea is welcome.'}</p><form onSubmit={submit} aria-busy={busy}><label>{de ? 'Titel' : 'Title'}<input name="title" maxLength={120} required autoFocus /></label><label>{de ? 'Beschreibe deine Idee' : 'Describe your idea'}<textarea name="description" maxLength={5000} rows={7} required /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={busy}>{busy ? de ? 'Wird veröffentlicht …' : 'Publishing …' : de ? 'Idee veröffentlichen' : 'Publish idea'}</button></form></div></div>;
}
