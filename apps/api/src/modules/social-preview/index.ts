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

type ShareRecord = { coverUrl: string | null };

async function coverBytes(db: Database, kind: 'events' | 'ideas', coverUrl: string | null) {
  if (coverUrl && /^\/api\/covers\/[a-f0-9-]{36}$/.test(coverUrl)) {
    const upload = db.prepare('SELECT data FROM cover_uploads WHERE id=?').get(coverUrl.slice('/api/covers/'.length)) as { data: string } | undefined;
    if (upload) return Buffer.from(upload.data, 'base64');
  }
  const filename = coverUrl?.match(/^\/covers\/([a-z0-9-]+\.(?:jpg|png|webp))$/i)?.[1] ?? fallbackCover[kind];
  return readFile(`${coverDirectory}${filename}`);
}

async function shareImage(bytes: Buffer) {
  const background = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize(1200, 630, { fit: 'cover' })
    .blur(36).modulate({ brightness: 0.4, saturation: 0.8 }).toBuffer();
  const roundedMask = Buffer.from('<svg width="510" height="510"><rect width="510" height="510" rx="18" fill="#fff"/></svg>');
  const cover = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize(510, 510, { fit: 'cover' })
    .composite([{ input: roundedMask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(background).composite([{ input: cover, left: 345, top: 60 }]).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

export function mountSocialPreviews(app: Express, db: Database) {
  app.get('/api/share/:kind/:id/image.jpg', async (request, response) => {
    const kind = kindSchema.safeParse(request.params.kind);
    const id = idSchema.safeParse(request.params.id);
    if (!kind.success || !id.success) { response.status(404).end(); return; }
    const record = kind.data === 'events'
      ? db.prepare('SELECT cover_url AS "coverUrl" FROM events WHERE id=? AND hidden=0').get(id.data) as ShareRecord | undefined
      : db.prepare('SELECT cover_url AS "coverUrl" FROM ideas WHERE id=? AND hidden=0').get(id.data) as ShareRecord | undefined;
    if (!record) { response.status(404).end(); return; }
    try {
      const image = await shareImage(await coverBytes(db, kind.data, record.coverUrl));
      response.set('Content-Type', 'image/jpeg');
      response.set('Cache-Control', 'public, max-age=300');
      response.set('X-Content-Type-Options', 'nosniff');
      response.send(image);
    } catch {
      response.status(503).end();
    }
  });
}
