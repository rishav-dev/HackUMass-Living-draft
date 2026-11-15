export interface Mailer {
  kind: 'smtp' | 'outbox' | 'none';
  send(to: string, subject: string, text: string): Promise<void>;
}

let mailer: Mailer = { kind: 'none', send: () => Promise.resolve() };

export function useMailer(next: Mailer) {
  mailer = next;
}

export const mail = {
  get kind() {
    return mailer.kind;
  },
  send: (to: string, subject: string, text: string) => mailer.send(to, subject, text),
};
