import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config';
import type { Mailer } from './mailer';

export function nodeMailer(): Mailer {
  const url = process.env.LIVING_DRAFT_SMTP;
  const from = process.env.LIVING_DRAFT_MAIL_FROM ?? 'The Living Draft <no-reply@localhost>';
  if (url) {
    let transport: Promise<{ sendMail: (message: object) => Promise<unknown> }> | null = null;
    return {
      kind: 'smtp',
      async send(to, subject, text) {
        transport ??= import('nodemailer').then((m) => m.createTransport(url));
        await (await transport).sendMail({ from, to, subject, text });
      },
    };
  }
  return {
    kind: 'outbox',
    async send(to, subject, text) {
      const dir = path.join(config.dataDir, 'outbox');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(
        path.join(dir, `${stamp}.txt`),
        `To: ${to}\nSubject: ${subject}\n\n${text}\n`,
      );
      console.log(
        `\n[mail to ${to}] ${subject}\n${text}\n(no mail server set up, so it's in data/outbox)\n`,
      );
    },
  };
}
