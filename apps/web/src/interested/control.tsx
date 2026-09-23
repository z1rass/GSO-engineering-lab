import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';

const schema = z.object({ count: z.number().int().nonnegative(), interested: z.boolean().nullable() });
const copy = {
  de: { label: 'Ich bin interessiert', withdraw: 'Interesse zurückziehen', login: 'Anmelden, um Interesse zu zeigen', loading: 'Interesse wird geladen …', saving: 'Wird gespeichert …', error: 'Dein Interesse wurde möglicherweise nicht gespeichert. Bitte versuche es erneut.', loadError: 'Interesse konnte nicht geladen werden.', retry: 'Erneut versuchen', session: 'Bitte melde dich erneut an.', signIn: 'Anmelden', count: (n: number) => n === 1 ? '1 interessiert' : `${n} Interessierte` },
  en: { label: 'I’m interested', withdraw: 'Withdraw interest', login: 'Sign in to show interest', loading: 'Loading interest …', saving: 'Saving …', error: 'Your interest may not have been saved. Please try again.', loadError: 'Could not load interest.', retry: 'Try again', session: 'Please sign in again.', signIn: 'Sign in', count: (n: number) => `${n} interested` },
};
export function InterestedControl({ target, language }: { target: string; language: Language }) {
  const path = `/api${target}/interested`;
  const resource = useResource(path, schema);
  const [saved, setSaved] = useState<z.infer<typeof schema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'session' | null>(null);
  const data = saved ?? resource.data;
  const t = copy[language];
  async function toggle() {
    if (!data || data.interested === null || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(path, { method: data.interested ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      if (response.status === 401) { setError('session'); setSaved({ ...data, interested: null }); return; }
      if (!response.ok) throw new Error('Interest write failed');
      const fresh = await fetch(path, { signal: AbortSignal.timeout(10000) });
      if (!fresh.ok) throw new Error('Interest read failed');
      setSaved(schema.parse(await fresh.json()));
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <section className="interested-control" aria-label={t.label} aria-busy={busy || resource.loading}>
    {!data ? resource.loading ? <p role="status">{t.loading}</p> : <p role="alert">{t.loadError} <button className="text-link" onClick={resource.retry}>{t.retry}</button></p>
      : <><div className="interested-row"><p className="interested-count" role="status" aria-live="polite" aria-atomic="true">{t.count(data.count)}</p>
        {data.interested === null ? <Link className="text-link" to="/login">{t.login} ↗</Link>
          : <button type="button" className="interested-button" aria-pressed={data.interested} disabled={busy} onClick={() => void toggle()}>{data.interested ? t.withdraw : t.label}</button>}
        {busy && <span role="status">{t.saving}</span>}
      </div></>}
    {error && <p className="form-error" role="alert">{t[error]}{error === 'session' && <> <Link className="text-link" to="/login">{t.signIn}</Link></>}</p>}
  </section>;
}
