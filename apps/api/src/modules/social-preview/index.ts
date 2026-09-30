import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import type { Database } from '../../database/index.js';

const idSchema = z.coerce.number().int().positive().max(2147483647);
const kindSchema = z.enum(['events', 'ideas']);
const coverDirectory = fileURLToPath(new URL('../../../../web/public/covers/', import.meta.url));
const fallbackCover = { events: 'event-ribbon.jpg', ideas: 'cover-ideas-paper.webp' } as const;
const fontFile = {
  medium: fileURLToPath(new URL('../../../assets/fonts/SpaceGrotesk-Medium.ttf', import.meta.url)),
  bold: fileURLToPath(new URL('../../../assets/fonts/SpaceGrotesk-Bold.ttf', import.meta.url)),
};

type ShareRecord = {
  title: string;
  coverUrl: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

function escapeMarkup(value: string) {
  return value.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!);
}

function textImage(value: string, size: number, width: number, options: { bold?: boolean; height?: number; color?: string } = {}) {
  const bold = options.bold ?? false;
  return sharp({ text: {
    text: `<span foreground="${options.color ?? '#f7f7f5'}">${escapeMarkup(value)}</span>`,
    font: `Space Grotesk ${bold ? 'Bold' : 'Medium'} ${size}`,
    fontfile: bold ? fontFile.bold : fontFile.medium,
    width,
    height: options.height,
    wrap: 'word-char',
    rgba: true,
  } }).png().toBuffer({ resolveWithObject: true });
}

function displayDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin',
  }).format(date);
}

async function coverBytes(db: Database, kind: 'events' | 'ideas', coverUrl: string | null) {
  if (coverUrl && /^\/api\/covers\/[a-f0-9-]{36}$/.test(coverUrl)) {
    const upload = db.prepare('SELECT data FROM cover_uploads WHERE id=?').get(coverUrl.slice('/api/covers/'.length)) as { data: string } | undefined;
    if (upload) return Buffer.from(upload.data, 'base64');
  }
  const filename = coverUrl?.match(/^\/covers\/([a-z0-9-]+\.(?:jpg|png|webp))$/i)?.[1] ?? fallbackCover[kind];
  return readFile(`${coverDirectory}${filename}`);
}

async function shareImage(bytes: Buffer, kind: 'events' | 'ideas', record: ShareRecord) {
  const roundedMask = Buffer.from('<svg width="538" height="538"><rect width="538" height="538" rx="17" fill="#fff"/></svg>');
  const cover = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize(538, 538, { fit: 'cover' })
    .composite([{ input: roundedMask, blend: 'dest-in' }]).png().toBuffer();
  const brand = await textImage('GSO Engineering Lab', 22, 470, { bold: true });
  let title = await textImage(record.title, 58, 510, { bold: true });
  if (title.info.height > 275) title = await textImage(record.title, 58, 510, { bold: true, height: 275 });
  const date = displayDate(record.date);
  const dateLine = kind === 'events' ? date ?? 'Termin folgt' : `Idee · ${date ?? 'GSO Engineering Lab'}`;
  const detailLine = kind === 'events'
    ? [record.startTime && `${record.startTime}${record.endTime ? ` – ${record.endTime}` : ''} Uhr`, record.location && `Raum ${record.location}`]
      .filter(Boolean).join(' · ') || 'GSO Engineering Lab'
    : 'Gemeinsam Ideen möglich machen.';
  const dateText = await textImage(dateLine, 29, 510, { bold: true });
  const detailText = await textImage(detailLine, 21, 510, { color: '#aaa9aa' });
  const decoration = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="surface"><stop stop-color="#202020"/><stop offset="1" stop-color="#151515"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#surface)"/>
    <path d="M635 471h510" stroke="#373737" stroke-width="1"/>
    <g transform="translate(636 80) rotate(-27 13 13)" fill="#b7d9d3">
      <rect x="3" y="8" width="4" height="18" rx="2"/><rect x="11" y="2" width="4" height="24" rx="2"/><rect x="19" y="12" width="4" height="14" rx="2"/>
    </g>
  </svg>`);
  return sharp(decoration).composite([
    { input: cover, left: 44, top: 46 },
    { input: brand.data, left: 675, top: 79 },
    { input: title.data, left: 635, top: 160 + Math.floor((275 - title.info.height) / 2) },
    { input: dateText.data, left: 635, top: 494 },
    { input: detailText.data, left: 635, top: 544 },
  ]).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export function mountSocialPreviews(app: Express, db: Database) {
  app.get('/api/share/:kind/:id/image.jpg', async (request, response) => {
    const kind = kindSchema.safeParse(request.params.kind);
    const id = idSchema.safeParse(request.params.id);
    if (!kind.success || !id.success) { response.status(404).end(); return; }
    const record = kind.data === 'events'
      ? db.prepare(`SELECT title,cover_url AS "coverUrl",planned_date AS date,start_time AS "startTime",
          end_time AS "endTime",general_location AS location FROM events WHERE id=? AND hidden=0`).get(id.data) as ShareRecord | undefined
      : db.prepare(`SELECT title,cover_url AS "coverUrl",created_at AS date,NULL AS "startTime",
          NULL AS "endTime",NULL AS location FROM ideas WHERE id=? AND hidden=0`).get(id.data) as ShareRecord | undefined;
    if (!record) { response.status(404).end(); return; }
    try {
      const image = await shareImage(await coverBytes(db, kind.data, record.coverUrl), kind.data, record);
      response.set('Content-Type', 'image/jpeg');
      response.set('Cache-Control', 'public, max-age=300');
      response.set('X-Content-Type-Options', 'nosniff');
      response.send(image);
    } catch {
      response.status(503).end();
    }
  });
}
