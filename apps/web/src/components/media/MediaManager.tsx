import { useState } from 'react';
import { FileAudio, FileVideo, Trash2 } from 'lucide-react';
import type { MediaDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useInvalidateArchive } from '../../api/hooks';
import { TextInput } from '../ui/controls';
import { useToast } from '../ui/Toast';

export function MediaManager({ media }: { media: MediaDto[] }) {
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);

  const saveCaption = async (item: MediaDto, caption: string) => {
    const next = caption.trim() || null;
    if (next === (item.caption ?? null)) return;
    await api.patch(`/media/${item.id}`, { caption: next });
    invalidate();
    toast('Caption saved');
  };

  const remove = async (item: MediaDto) => {
    await api.delete(`/media/${item.id}`);
    setConfirming(null);
    invalidate();
    toast('File removed from this computer');
  };

  return (
    <ul className="flex flex-col gap-3">
      {media.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 p-2"
        >
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-abyss">
            {item.kind === 'photo' || item.kind === 'scan' ? (
              <img src={item.url} alt="" className="size-full object-cover" />
            ) : item.kind === 'video' ? (
              <FileVideo className="size-5 text-ink-soft" />
            ) : (
              <FileAudio className="size-5 text-ink-soft" />
            )}
          </span>
          <TextInput
            aria-label={`Caption for this ${item.kind}`}
            defaultValue={item.caption ?? ''}
            placeholder="Add a caption"
            onBlur={(e) => void saveCaption(item, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="h-9 min-w-0 flex-1 py-1 text-sm"
          />
          {confirming === item.id ? (
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void remove(item)}
                className="rounded-full bg-rose/85 px-3 py-1.5 text-xs font-bold text-snow hover:bg-rose"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-full px-2 py-1.5 text-xs font-semibold text-ink-soft"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label="Delete this file"
              onClick={() => setConfirming(item.id)}
              className="shrink-0 rounded-full p-2 text-ink-faint hover:bg-white/8 hover:text-rose-deep"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
