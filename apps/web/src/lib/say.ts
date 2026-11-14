import { speak } from './narration';

export function say(text: string): Promise<void> {
  return new Promise((resolve) => {
    speak(text, { onEnd: resolve });
  });
}
