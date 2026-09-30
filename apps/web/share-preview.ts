import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

type SharedContent = { title: string; description: string };
type Next = (error?: unknown) => void;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function requestOrigin(request: IncomingMessage) {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch { /* Fall back to the request host. */ }
  }
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim() ?? request.headers.host;
  if (!host) return null;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0]?.trim() === 'https' ? 'https' : 'http';
  try { return new URL(`${protocol}://${host}`).origin; } catch { return null; }
}

function renderMetadata(html: string, content: SharedContent, kind: 'events' | 'ideas', id: string, origin: string) {
  const title = escapeHtml(content.title);
  const plainDescription = content.description.replace(/\s+/g, ' ').trim();
  const shortDescription = Array.from(plainDescription).length > 220
    ? `${Array.from(plainDescription).slice(0, 220).join('').replace(/\s+\S*$/, '')}…`
    : plainDescription;
  const description = escapeHtml(shortDescription);
  const url = escapeHtml(`${origin}/${kind}/${id}`);
  const image = escapeHtml(`${origin}/api/share/${kind}/${id}/image.jpg`);
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="GSO Engineering Lab" />',
    '<meta property="og:locale" content="de_DE" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="Titelbild: ${title}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');
  return html.replace(/<title>[^<]*<\/title>/, `<title>${title} · GSO Engineering Lab</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

export function sharePreview(apiTarget: string): Plugin {
  let root = '';
  let outDir = '';

  async function serve(request: IncomingMessage, response: ServerResponse, next: Next,
    template: string, transform: (path: string, html: string) => Promise<string>) {
    if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const match = /^\/(events|ideas)\/([1-9]\d*)\/?$/.exec(path);
    if (!match) { next(); return; }
    const kind = match[1] as 'events' | 'ideas';
    const id = match[2]!;
    const origin = requestOrigin(request);
    if (!origin) { next(); return; }
    try {
      const apiResponse = await fetch(new URL(`/api/${kind}/${id}`, apiTarget), { signal: AbortSignal.timeout(5000) });
      if (!apiResponse.ok) { next(); return; }
      const payload = await apiResponse.json() as { event?: SharedContent; idea?: SharedContent };
      const content = kind === 'events' ? payload.event : payload.idea;
      if (typeof content?.title !== 'string' || typeof content.description !== 'string') { next(); return; }
      const html = renderMetadata(await readFile(template, 'utf8'), content, kind, id, origin);
      const result = await transform(path, html);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Vary', 'Host, X-Forwarded-Host, X-Forwarded-Proto');
      response.end(request.method === 'HEAD' ? undefined : result);
    } catch { next(); }
  }

  return {
    name: 'gso-social-preview',
    configResolved(config) {
      root = config.root;
      outDir = resolve(root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void serve(request, response, next, resolve(root, 'index.html'), (path, html) => server.transformIndexHtml(path, html));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        void serve(request, response, next, resolve(outDir, 'index.html'), async (_path, html) => html);
      });
    },
  };
}
