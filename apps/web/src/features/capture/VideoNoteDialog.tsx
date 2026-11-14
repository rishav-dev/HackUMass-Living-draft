import { useEffect, useRef, useState } from 'react';
import { Circle, Square, Video } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { formatDuration, useRecorder, type Recording } from '../../lib/recorder';
import { haptic } from '../../lib/haptics';
import { useSound } from '../../lib/sound/SoundProvider';

export function VideoNoteDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (recording: Recording) => void;
}) {
  const recorder = useRecorder();
  const preview = useRef<HTMLVideoElement>(null);
  const [result, setResult] = useState<Recording | null>(null);
  const { play } = useSound();

  useEffect(() => {
    if (preview.current && recorder.stream) {
      preview.current.srcObject = recorder.stream;
      void preview.current.play().catch(() => undefined);
    }
  }, [recorder.stream]);

  const close = () => {
    recorder.cancel();
    setResult(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Record a video note"
      description="Say it to the camera. It stays on this computer."
      width="max-w-2xl"
    >
      <div className="overflow-hidden rounded-2xl bg-night">
        {result ? (
          <video src={result.url} controls playsInline className="aspect-video w-full" />
        ) : (
          <video
            ref={preview}
            muted
            playsInline
            className="aspect-video w-full -scale-x-100 object-cover"
          />
        )}
      </div>
      {recorder.error && (
        <p className="mt-3 text-sm font-semibold text-rose-deep">{recorder.error}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold tabular-nums text-ink-soft">
          {recorder.state === 'recording' && (
            <span className="size-2.5 animate-pulse rounded-full bg-rose-deep" />
          )}
          {formatDuration(recorder.elapsed)}
        </span>
        <div className="flex gap-2">
          {!result && recorder.state !== 'recording' && (
            <Button
              icon={<Circle className="size-4 fill-rose-deep text-rose-deep" />}
              onClick={async () => {
                if (await recorder.start({ video: true })) {
                  play('start');
                  haptic('start');
                }
              }}
              sound={false}
            >
              Start recording
            </Button>
          )}
          {recorder.state === 'recording' && (
            <Button
              icon={<Square className="size-4" />}
              onClick={async () => {
                play('stop');
                haptic('stop');
                setResult(await recorder.stop());
              }}
              sound={false}
            >
              Stop
            </Button>
          )}
          {result && (
            <>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Record again
              </Button>
              <Button
                icon={<Video className="size-4" />}
                onClick={() => {
                  onDone(result);
                  setResult(null);
                  onClose();
                }}
              >
                Keep this video
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
