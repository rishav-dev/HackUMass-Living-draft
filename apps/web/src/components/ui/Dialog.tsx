import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useSound } from '../../lib/sound/SoundProvider';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  dismissable?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
  dismissable = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { play } = useSound();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      play('open');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, play]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissable) event.preventDefault();
      }}
      closedby={dismissable ? 'any' : 'none'}
      className={`paper m-auto w-[calc(100%-2rem)] ${width} rounded-3xl p-0 text-ink`}
    >
      <div className="max-h-[85dvh] overflow-y-auto p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-2xl font-semibold">
              {title}
            </h2>
            {description && <div className="mt-1 text-ink-soft">{description}</div>}
          </div>
          {dismissable && (
            <button
              type="button"
              aria-label="Close"
              className="-mr-2 -mt-1 inline-flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
              onClick={() => {
                play('close');
                onClose();
              }}
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}
