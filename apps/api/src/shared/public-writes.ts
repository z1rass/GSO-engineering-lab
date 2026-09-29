import type { RequestHandler } from 'express';

export const trustedOrigin: RequestHandler = (request, response, next) => {
  const origin = request.get('origin');
  const configured = new URL(process.env.AUTH_BASE_URL ?? 'http://localhost:5173').origin;
  const additional = (process.env.AUTH_ADDITIONAL_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const loopback = process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin ?? '');
  if (!origin || (origin !== configured && !additional.includes(origin) && !loopback)) {
    response.status(403).json({ error: 'INVALID_ORIGIN' }); return;
  }
  next();
};

export function limitWrites(max: number, windowMs: number): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (request, response, next) => {
    const now = Date.now();
    for (const [key, attempt] of attempts) if (attempt.resetAt <= now) attempts.delete(key);
    const key = response.locals.visitorId ?? request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const current = attempts.get(key) ?? { count: 0, resetAt: now + windowMs };
    if (current.count >= max) {
      response.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      response.status(429).json({ error: 'TOO_MANY_ATTEMPTS' }); return;
    }
    current.count += 1;
    attempts.set(key, current);
    next();
  };
}
