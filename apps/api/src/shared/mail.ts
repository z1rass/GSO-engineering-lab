import nodemailer from 'nodemailer';

export function createMailTransport() {
  const production = process.env.NODE_ENV === 'production';
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? '127.0.0.1',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: production && process.env.SMTP_SECURE !== 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
}
