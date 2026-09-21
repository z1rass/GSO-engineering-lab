import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { authCopy } from './copy';

const profileResponse = z.object({ user: z.object({
  id: z.string(), name: z.string(), email: z.email(), affiliation: z.literal('MEMBER'),
  education: z.string().nullable(), year: z.number().nullable(), interests: z.array(z.string()).nullable(),
}) });
type Profile = z.infer<typeof profileResponse>['user'];

async function send(path: string, body: unknown, method = 'POST') {
  return fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
}

export function LoginPage({ language }: { language: Language }) {
  const t = authCopy[language];
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<'error' | 'rate' | 'invalid' | null>(params.has('error') ? 'invalid' : null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(null); setSent(false);
    try {
      const response = await send('/api/auth/sign-in/magic-link', { name: data.get('name'), email: String(data.get('email')).trim().toLowerCase(),
        callbackURL: '/profile', newUserCallbackURL: '/profile', errorCallbackURL: '/login' });
      if (!response.ok) { setError(response.status === 429 ? 'rate' : 'error'); return; }
      setSent(true);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <section className="account-page"><div className="account-heading"><p className="eyebrow">GSO engineering lab</p><h1>{t.title}</h1><p>{t.intro}</p></div>
    <form className="account-form" onSubmit={submit} aria-busy={busy}>
      <label>{t.name}<input name="name" autoComplete="name" required maxLength={100} /></label>
      <label>{t.email}<input name="email" type="email" autoComplete="email" required pattern="[^@\s]+@gso\.schule\.koeln" aria-describedby="email-hint" /></label>
      <p id="email-hint" className="field-hint">{t.emailHint}</p>
      {error && <p role="alert" className="form-error">{t[error]}</p>}
      {sent && <p role="status" className="form-success">{t.sent}</p>}
      <button className="button-primary" disabled={busy}>{busy ? t.sending : sent ? t.resend : t.send}<span aria-hidden="true">↗</span></button>
    </form>
  </section>;
}

export function ProfilePage({ language }: { language: Language }) {
  const t = authCopy[language];
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'anonymous' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'error' | 'saved' | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    void fetch('/api/me', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async response => {
      if (response.status === 401) { setState('anonymous'); return; }
      if (!response.ok) throw new Error('Profile unavailable');
      setProfile(profileResponse.parse(await response.json()).user); setState('ready');
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [attempt]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setFeedback(null);
    try {
      const response = await send('/api/me', { name: data.get('name'), education: data.get('education') || null,
        year: data.get('year') ? Number(data.get('year')) : null,
        interests: String(data.get('interests')).split(',').map(s => s.trim()).filter(Boolean),
      }, 'PATCH');
      if (response.status === 401) { navigate('/login'); return; }
      if (!response.ok) throw new Error('Save failed');
      setFeedback('saved');
    } catch { setFeedback('error'); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setFeedback(null);
    try {
      const response = await send('/api/auth/sign-out', {});
      if (!response.ok) throw new Error('Sign out failed');
      navigate('/login');
    } catch { setFeedback('error'); } finally { setBusy(false); }
  }
  if (state === 'anonymous') return <Navigate to="/login" replace />;
  if (state === 'loading') return <section className="account-page"><p role="status">{t.loading}</p></section>;
  if (state === 'error' || !profile) return <section className="account-page"><p role="alert">{t.error}</p><button className="text-link" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button></section>;
  return <section className="account-page"><div className="account-heading"><p className="eyebrow">GSO engineering lab</p><h1>{t.profileTitle}</h1><p>{t.profileIntro}</p></div>
    <form className="account-form" onSubmit={save} aria-busy={busy} onChange={() => setFeedback(null)}>
      <label>{t.name}<input name="name" autoComplete="name" required maxLength={100} defaultValue={profile.name} /></label>
      <label>{t.email}<input type="email" readOnly value={profile.email} aria-describedby="private-email" /></label>
      <p id="private-email" className="field-hint">{t.privateEmail}</p>
      <fieldset><legend>{t.optional}</legend><div className="profile-columns">
        <label>{t.education}<input name="education" maxLength={100} defaultValue={profile.education ?? ''} /></label>
        <label>{t.year}<input name="year" type="number" min={1} max={6} defaultValue={profile.year ?? ''} /></label>
      </div><label>{t.interests}<input name="interests" defaultValue={profile.interests?.join(', ') ?? ''} aria-describedby="interests-hint" /></label>
      <p id="interests-hint" className="field-hint">{t.interestsHint}</p></fieldset>
      {feedback && <p role={feedback === 'error' ? 'alert' : 'status'} className={feedback === 'error' ? 'form-error' : 'form-success'}>{t[feedback]}</p>}
      <div className="account-actions"><button className="button-primary" disabled={busy}>{busy ? t.saving : t.save}</button><button type="button" className="text-link" disabled={busy} onClick={() => void logout()}>{t.logout}</button></div>
    </form>
  </section>;
}
