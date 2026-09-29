import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../shared/icon';
import { activityCover } from '../activity-covers';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const de = language === 'de';
  const cover = activityCover('idea', title);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), description: description.trim() }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { setError(response.status === 429 ? de ? 'Zu viele Ideen in kurzer Zeit. Bitte später erneut versuchen.' : 'Too many ideas in a short time. Please try again later.' : de ? 'Idee konnte nicht gespeichert werden. Bitte prüfe deine Eingaben.' : 'Could not save the idea. Please check your entries.'); return; }
      const result = await response.json() as { idea: { id: number } };
      navigate(`/ideas/${result.idea.id}`);
    } catch { setError(de ? 'Keine Verbindung. Bitte erneut versuchen.' : 'Connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="public-idea-page"><Link className="story-back" to="/ideas"><Icon name="arrow-left" size={17} />{de ? 'Alle Ideen' : 'All ideas'}</Link><div className="public-idea-heading"><span className="idea-form-eyebrow"><Icon name="spark" size={17} /> {de ? 'Eine Idee für das Lab' : 'An idea for the Lab'}</span><h1>{de ? 'Was sollten wir als Nächstes machen?' : 'What should we do next?'}</h1><p>{de ? 'Ein Projekt, Workshop oder Thema, das dich interessiert: Teile es mit der Community. Andere können dafür abstimmen.' : 'A project, workshop or topic you care about: share it with the community. Others can vote for it.'}</p></div><div className="public-idea-layout"><div className="public-idea-panel"><form onSubmit={submit} aria-busy={busy}><label htmlFor="idea-title">{de ? 'Deine Idee in einem Satz' : 'Your idea in one line'}</label><input id="idea-title" name="title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder={de ? 'z. B. Gemeinsam einen Roboter bauen' : 'e.g. Build a robot together'} required autoFocus /><span className="idea-field-hint">{title.length}/120</span><label htmlFor="idea-description">{de ? 'Erzähl uns mehr' : 'Tell us more'}</label><textarea id="idea-description" name="description" maxLength={5000} rows={7} value={description} onChange={event => setDescription(event.target.value)} placeholder={de ? 'Was möchtest du ausprobieren? Warum wäre das spannend? Du brauchst noch keinen fertigen Plan.' : 'What would you like to explore? Why would it be interesting? You do not need a finished plan.'} required /><span className="idea-field-hint">{description.length}/5000</span><p className="idea-publish-note"><Icon name="people" size={18} />{de ? 'Deine Idee wird öffentlich sichtbar. Du brauchst keinen Account und musst sie nicht selbst organisieren.' : 'Your idea will be public. No account is needed, and you do not have to organize it yourself.'}</p>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={busy || !title.trim() || !description.trim()}><Icon name="arrow-right" size={17} />{busy ? de ? 'Wird veröffentlicht …' : 'Publishing …' : de ? 'Idee veröffentlichen' : 'Publish idea'}</button></form></div><aside className="idea-form-preview" aria-label={de ? 'Vorschau deiner Idee' : 'Idea preview'}><img src={cover.src} alt="" width="460" height="460" /><div><span>{de ? 'VORSCHAU' : 'PREVIEW'} / GSO LAB</span><strong>{title.trim() || (de ? 'Deine Idee' : 'Your idea')}</strong><p>{description.trim() || (de ? 'Hier beginnt vielleicht das nächste Lab-Projekt.' : 'The next Lab project might start here.')}</p></div></aside></div></div>;
}
