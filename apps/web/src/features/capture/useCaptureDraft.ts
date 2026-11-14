import { useCallback, useState } from 'react';
import type { MediaDto } from '@living-draft/contracts';
import { uploadMedia } from '../../api/client';

export type CaptureKind = 'memory' | 'reflection' | 'capsule';

export interface Attachment {
  localId: string;
  media: MediaDto | null;
  previewUrl: string;
  kind: 'photo' | 'video' | 'audio';
  name: string;
  error?: string;
}

export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);

  const add = useCallback(
    async (
      file: Blob,
      options: { name: string; durationMs?: number; caption?: string; kind?: string },
    ) => {
      const localId = crypto.randomUUID();
      const type = file.type.split('/')[0];
      const kind = type === 'image' ? 'photo' : type === 'video' ? 'video' : 'audio';
      const previewUrl = URL.createObjectURL(file);
      setItems((list) => [...list, { localId, media: null, previewUrl, kind, name: options.name }]);
      try {
        const media = await uploadMedia(file, options);
        setItems((list) =>
          list.map((item) => (item.localId === localId ? { ...item, media } : item)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setItems((list) =>
          list.map((item) => (item.localId === localId ? { ...item, error: message } : item)),
        );
      }
    },
    [],
  );

  const remove = useCallback((localId: string) => {
    setItems((list) => list.filter((item) => item.localId !== localId));
  }, []);

  return {
    items,
    add,
    remove,
    ready: items.every((i) => i.media || i.error),
    mediaIds: items.map((i) => i.media?.id).filter((id): id is string => !!id),
  };
}
