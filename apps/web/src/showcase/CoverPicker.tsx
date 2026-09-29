import { useState } from 'react';
import { eventCoverGallery } from '../activity-covers';

type Language = 'de' | 'en';

export function CoverPicker({ language, value, onChange }: { language: Language; value: string | null; onChange: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const de = language === 'de';
  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
      setError(de ? 'Bitte JPG, PNG oder WebP bis 2 MB wählen.' : 'Choose a JPG, PNG or WebP up to 2 MB.'); return;
    }
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(file);
      });
      const response = await fetch('/api/admin/covers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mimeType: file.type, data }), signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json() as { coverUrl: string };
      onChange(result.coverUrl);
    } catch { setError(de ? 'Bild konnte nicht hochgeladen werden. Bitte erneut versuchen.' : 'Could not upload image. Please try again.'); }
    finally { setBusy(false); }
  }
  return <fieldset className="cover-picker"><legend>{de ? 'Titelbild' : 'Cover image'}</legend><div className="cover-options">{eventCoverGallery.map((cover, index) => <button key={cover.src} type="button" className="cover-option" aria-label={`${de ? 'Vorlage' : 'Preset'} ${index + 1}`} aria-pressed={value === cover.src} onClick={() => onChange(cover.src)}><img src={cover.src} alt="" width="76" height="76" /></button>)}</div><label className="cover-upload">{de ? 'Eigenes Bild hochladen' : 'Upload your image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => void upload(event.target.files?.[0])} /></label>{busy && <p role="status">{de ? 'Bild wird hochgeladen …' : 'Uploading image …'}</p>}{value?.startsWith('/api/covers/') && <p>{de ? 'Eigenes Bild ausgewählt' : 'Your image selected'}</p>}{error && <p className="admin-error" role="alert">{error}</p>}</fieldset>;
}
