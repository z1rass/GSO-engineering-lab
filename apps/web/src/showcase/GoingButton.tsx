import { useEffect, useState } from 'react';
import { Icon } from '../shared/icon';
import { eventIsPast, type Event } from './data';

export function GoingButton({ event, language }: { event: Event; language: 'de' | 'en' }) {
  const [going, setGoing] = useState(event.going);
  const [count, setCount] = useState(event.goingCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setGoing(event.going); setCount(event.goingCount); }, [event.id, event.going, event.goingCount]);
  const de = language === 'de';
  const open = Boolean(event.plannedDate && !eventIsPast(event));
  async function toggle() {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/events/${event.id}/going`, { method: going ? 'DELETE' : 'POST', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Could not save attendance');
      const result = await response.json() as { going: boolean; goingCount: number };
      setGoing(result.going); setCount(result.goingCount);
    } catch { setError(true); } finally { setBusy(false); }
  }
  if (!open && count === 0) return null;
  return <div className="going-panel"><div className="going-copy"><span className="going-kicker">{de ? 'Gemeinsam dabei' : 'Join the community'}</span><strong>{count === 0 ? de ? 'Sei dabei' : 'Come along' : `${count} ${de ? count === 1 ? 'Person ist dabei' : 'Personen sind dabei' : count === 1 ? 'person is going' : 'people are going'}`}</strong><span>{de ? 'Ohne Anmeldung – du kannst deine Zusage jederzeit zurücknehmen.' : 'No account needed – you can change your mind anytime.'}</span></div>{open && (going ? <span className="going-button going-confirmed"><Icon name="check" size={18} />{de ? 'Du bist dabei' : "You're going"}</span> : <button className="going-button" type="button" disabled={busy} onClick={() => void toggle()}><Icon name="plus" size={18} />{de ? 'Ich bin dabei' : "I'm going"}</button>)}{going && open && <button className="going-cancel" type="button" disabled={busy} onClick={() => void toggle()}>{de ? 'Zusage zurücknehmen' : 'Cancel RSVP'}</button>}{error && <small className="going-error" role="alert">{de ? 'Deine Zusage konnte nicht gespeichert werden. Bitte versuche es erneut.' : 'Could not save your RSVP. Please try again.'}</small>}</div>;
}
