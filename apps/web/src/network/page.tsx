import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';
import './styles.css';

const contactSchema = z.object({
  id: z.number(), name: z.string(), company: z.string(), professionalRole: z.string(), topics: z.array(z.string()),
  notes: z.string(), contactMethod: z.string(), source: z.string(), createdAt: z.string(), updatedAt: z.string(),
  addedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
});
const schema = z.object({ contacts: z.array(contactSchema) });
type Contact = z.infer<typeof contactSchema>;
const copy = {
  de: { title: 'Club Network', intro: 'Kontakte für künftige Talks, Workshops und gemeinsame Projekte. Nur für Ops sichtbar.', back: 'Ops-Team', create: 'Kontakt hinzufügen', edit: 'Kontakt bearbeiten', save: 'Kontakt speichern', cancel: 'Abbrechen', name: 'Name', company: 'Unternehmen', professionalRole: 'Berufliche Rolle', topics: 'Themen', topicsHint: 'Mit Kommas trennen, höchstens 20 Themen.', notes: 'Notizen', contactMethod: 'Kontaktweg', contactHint: 'Zum Beispiel E-Mail oder ein berufliches Profil. Nur nötige Angaben speichern.', source: 'Herkunft des Kontakts', addedBy: 'Hinzugefügt von', created: 'Hinzugefügt am', updated: 'Aktualisiert am', unknown: 'Gelöschter Account', empty: 'Noch keine Kontakte.', loading: 'Kontakte werden geladen …', saving: 'Wird gespeichert …', error: 'Die Kontakte konnten nicht geladen werden.', writeError: 'Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.', invalid: 'Prüfe Name, Textlängen und Themen.', missing: 'Der Kontakt wurde inzwischen gelöscht. Lade die Liste neu.', retry: 'Neu laden', denied: 'Dieser Bereich ist nur für Ops zugänglich.', guidance: 'Für Hilfe mit Speakern oder Kontakten schreibe dem Ops-Team im Discord.', login: 'Anmelden', remove: 'Kontakt löschen', confirm: 'Diesen Kontakt dauerhaft löschen?', deleteHint: 'Kontaktangaben und Notizen werden entfernt. Das kann nicht rückgängig gemacht werden.', keep: 'Kontakt behalten', delete: 'Dauerhaft löschen' },
  en: { title: 'Club Network', intro: 'Contacts for future talks, workshops and shared projects. Visible only to Ops.', back: 'Ops team', create: 'Add contact', edit: 'Edit contact', save: 'Save contact', cancel: 'Cancel', name: 'Name', company: 'Company', professionalRole: 'Professional role', topics: 'Topics', topicsHint: 'Separate with commas, up to 20 topics.', notes: 'Notes', contactMethod: 'Contact method', contactHint: 'For example an email or professional profile. Only keep necessary details.', source: 'Contact source', addedBy: 'Added by', created: 'Added on', updated: 'Updated on', unknown: 'Deleted account', empty: 'No contacts yet.', loading: 'Loading contacts …', saving: 'Saving …', error: 'Could not load contacts.', writeError: 'Could not confirm the change. Please try again.', invalid: 'Check the name, text lengths and topics.', missing: 'This contact has been deleted. Reload the list.', retry: 'Reload', denied: 'This area is only available to Ops.', guidance: 'For help with speakers or contacts, message the Ops team in Discord.', login: 'Sign in', remove: 'Delete contact', confirm: 'Permanently delete this contact?', deleteHint: 'Contact details and notes will be removed. This cannot be undone.', keep: 'Keep contact', delete: 'Permanently delete' },
};

function useContactWrite(done: () => void) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<'writeError' | 'invalid' | 'missing' | null>(null);
  async function save(path: string, method: string, body?: unknown) {
    setBusy(true); setError(null);
    try {
      const result = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
      if ([401, 403].includes(result.status)) { done(); return; }
      if (!result.ok) { setError(result.status === 400 ? 'invalid' : result.status === 404 ? 'missing' : 'writeError'); return; }
      done();
    } catch { setError('writeError'); } finally { setBusy(false); }
  }
  return { busy, error, save };
}

function ContactForm({ contact, language, done, cancel }: { contact?: Contact; language: Language; done: () => void; cancel?: () => void }) {
  const t = copy[language]; const id = useId(); const state = useContactWrite(done);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body = { name: form.get('name'), company: form.get('company'), professionalRole: form.get('professionalRole'),
      topics: String(form.get('topics')).split(',').map(topic => topic.trim()).filter(Boolean), notes: form.get('notes'), contactMethod: form.get('contactMethod'), source: form.get('source') };
    void state.save(contact ? `/api/ops/network/${contact.id}` : '/api/ops/network', contact ? 'PATCH' : 'POST', body);
  }
  return <form className="account-form idea-form" aria-label={contact ? t.edit : t.create} onSubmit={submit} aria-busy={state.busy}>
    <label>{t.name}<input name="name" required maxLength={120} defaultValue={contact?.name} /></label>
    <label>{t.company}<input name="company" maxLength={200} defaultValue={contact?.company} /></label>
    <label>{t.professionalRole}<input name="professionalRole" maxLength={200} defaultValue={contact?.professionalRole} /></label>
    <label>{t.topics}<input name="topics" maxLength={1640} defaultValue={contact?.topics.join(', ')} aria-describedby={`${id}-topics`} /></label><p className="field-hint" id={`${id}-topics`}>{t.topicsHint}</p>
    <label>{t.contactMethod}<input name="contactMethod" maxLength={1000} defaultValue={contact?.contactMethod} aria-describedby={`${id}-contact`} /></label><p className="field-hint" id={`${id}-contact`}>{t.contactHint}</p>
    <label>{t.source}<input name="source" maxLength={1000} defaultValue={contact?.source} /></label>
    <label><span id={`${id}-notes`}>{t.notes}</span><textarea name="notes" rows={4} maxLength={5000} defaultValue={contact?.notes} aria-labelledby={`${id}-notes`} /></label>
    {state.error && <p role="alert">{t[state.error]}</p>}
    <div className="account-actions"><button className="button-primary" disabled={state.busy}>{state.busy ? t.saving : t.save}</button>{cancel && <button type="button" className="text-link" disabled={state.busy} onClick={cancel}>{t.cancel}</button>}</div>
  </form>;
}

function ContactEntry({ contact, language, done }: { contact: Contact; language: Language; done: () => void }) {
  const t = copy[language]; const [editing, setEditing] = useState(false); const [confirming, setConfirming] = useState(false); const state = useContactWrite(done);
  const date = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return <article className="network-contact" aria-label={contact.name}><h2>{contact.name}</h2>
    {editing ? <ContactForm contact={contact} language={language} done={done} cancel={() => setEditing(false)} /> : <>
      <p className="network-company">{[contact.professionalRole, contact.company].filter(Boolean).join(' · ')}</p>
      <dl className="network-details">
        {contact.topics.length > 0 && <div><dt>{t.topics}</dt><dd>{contact.topics.join(', ')}</dd></div>}
        {contact.contactMethod && <div><dt>{t.contactMethod}</dt><dd>{contact.contactMethod}</dd></div>}
        {contact.source && <div><dt>{t.source}</dt><dd>{contact.source}</dd></div>}
        {contact.notes && <div><dt>{t.notes}</dt><dd>{contact.notes}</dd></div>}
      </dl>
      <p className="field-hint">{t.addedBy}: {contact.addedBy?.name ?? t.unknown}</p>
      <p className="field-hint">{t.created}: <time dateTime={contact.createdAt}>{date.format(new Date(contact.createdAt))}</time> · {t.updated}: <time dateTime={contact.updatedAt}>{date.format(new Date(contact.updatedAt))}</time></p>
      {confirming ? <div className="network-confirm"><p><strong>{t.confirm}</strong> {contact.name}</p><p>{t.deleteHint}</p><div className="account-actions"><button className="button-primary" disabled={state.busy} onClick={() => void state.save(`/api/ops/network/${contact.id}`, 'DELETE')}>{state.busy ? t.saving : t.delete}</button><button className="text-link" disabled={state.busy} onClick={() => setConfirming(false)}>{t.keep}</button></div></div> : <div className="account-actions"><button className="text-link" onClick={() => setEditing(true)}>{t.edit}</button><button className="text-link" onClick={() => setConfirming(true)}>{t.remove}</button></div>}
      {state.error && <p role="alert">{t[state.error]} <button className="text-link" onClick={done}>{t.retry}</button></p>}
    </>}
  </article>;
}

export function NetworkPage({ language }: { language: Language }) {
  const t = copy[language]; const resource = useResource('/api/ops/network', schema);
  return <section className="network-page"><Link className="text-link" to="/ops">{t.back}</Link><h1>{t.title}</h1>
    {resource.loading ? <p role="status">{t.loading}</p> : !resource.data ? [401, 403].includes(resource.status) ? <div><p role="alert">{t.denied}</p><p>{t.guidance}</p>{resource.status === 401 && <Link className="text-link" to="/login">{t.login}</Link>}</div> : <div><p role="alert">{t.error}</p><button className="text-link" onClick={resource.retry}>{t.retry}</button></div> : <>
      <p className="network-intro">{t.intro}</p>
      <details className="project-form-section"><summary>{t.create}</summary><ContactForm language={language} done={resource.retry} /></details>
      {!resource.data.contacts.length ? <p className="network-empty">{t.empty}</p> : resource.data.contacts.map(contact => <ContactEntry key={contact.id} contact={contact} language={language} done={resource.retry} />)}
    </>}
  </section>;
}
