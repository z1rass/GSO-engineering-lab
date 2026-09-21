import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

/** Real HTTP and SMTP journey shared by integration fixtures; no auth bypass. */
export async function requestTestLink(base: string, origin: string, name = 'Ada') {
  const email = `test-${randomUUID()}@gso.schule.koeln`;
  const response = await fetch(`${base}/api/auth/sign-in/magic-link`, { method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, callbackURL: '/profile' }),
  });
  expect(response.status).toBe(200);
  const mailbox = await fetch(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json());
  expect(mailbox.messages).toHaveLength(1);
  const mail = await fetch(`http://127.0.0.1:8025/api/v1/message/${mailbox.messages[0].ID}`).then(r => r.json());
  return { email, url: new URL(mail.Text.match(/https?:\/\/\S+/)[0]) };
}

export async function redeemTestLink(base: string, url: URL) {
  const verified = await fetch(`${base}${url.pathname}${url.search}`, { redirect: 'manual' });
  expect(verified.status).toBe(302);
  const cookie = verified.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  return { verified, cookie };
}
