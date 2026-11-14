import { useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { downloadFromApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';

export function ShareChapter({
  age,
  title,
  quietCount,
}: {
  age: number;
  title: string;
  quietCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [quiet, setQuiet] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        icon={<Share2 className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Share as a page
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Share ${title}`}
        description="Makes one file with this chapter's words and photos that you can send to someone you choose. It's built here and not uploaded anywhere."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Not now
            </Button>
            <Button
              icon={<Download className="size-4" />}
              onClick={() => {
                setOpen(false);
                void downloadFromApi(
                  `/chapters/${age}/share${quiet ? '?quiet=1' : ''}`,
                  `living-draft-chapter-${age}.html`,
                );
              }}
            >
              Download the page
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            Only the reading copy goes in: no first tellings, no feelings tags, no links to other
            chapters.
          </li>
          <li>Recordings and videos stay here. Up to four photos per memory are included.</li>
          <li>Once you send it, it's out of your hands, so choose who gets it with care.</li>
        </ul>
        {quietCount > 0 && (
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4"
              checked={quiet}
              onChange={(e) => setQuiet(e.target.checked)}
            />
            Include {quietCount} {quietCount === 1 ? 'memory' : 'memories'} kept quiet
          </label>
        )}
      </Dialog>
    </>
  );
}
