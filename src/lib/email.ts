/**
 * Email sending helper backed by Nodemailer.
 *
 * Required environment variables (when SMTP is enabled):
 *   SMTP_HOST  – SMTP server hostname
 *   SMTP_PORT  – SMTP server port (defaults to 587)
 *   SMTP_USER  – SMTP username / login
 *   SMTP_PASS  – SMTP password
 *   EMAIL_FROM – "From" address, e.g. "Miner4 <noreply@miner4.io>"
 *
 * When none of SMTP_HOST/SMTP_USER/SMTP_PASS are set the helper runs in
 * "console" mode: emails are logged to stdout rather than sent, which is
 * convenient during local development.
 */

import nodemailer from 'nodemailer';
import { createLogger } from '@/lib/logger';

const log = createLogger('email');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user, pass },
  });
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const transport = createTransport();

  if (!transport) {
    // Development fallback: log the email body to the console
    log.info('Email (console mode)', {
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return;
  }

  const from = process.env.EMAIL_FROM ?? '"Miner4" <noreply@miner4.io>';
  await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
  log.info('Email sent', { to: opts.to, subject: opts.subject });
}
