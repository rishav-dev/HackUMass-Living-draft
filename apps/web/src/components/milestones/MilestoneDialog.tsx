import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import type { MilestoneDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useInvalidateArchive, useMemories, useProfile } from '../../api/hooks';
import { Button } from '../ui/Button';
import { Segmented, Stepper, TextArea, TextInput } from '../ui/controls';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

const IDEAS = [
  'Started school',
  'Moved to a new home',
  'A sibling was born',
  'Lost someone',
  'First job',
  'Learned to drive',
  'Graduated',
  'Moved out',
  'Fell in love',
  'Started over somewhere new',
];

type When = 'date' | 'month' | 'age';

function initialWhen(milestone: MilestoneDto | null): When {
  if (milestone?.date) return milestone.date.length === 7 ? 'month' : 'date';
  return 'age';
}

export function MilestoneDialog({
  milestone,
  startAge = null,
  onClose,
}: {
  milestone: MilestoneDto | null;
  startAge?: number | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { data: profile } = useProfile();
  const { data: memories } = useMemories({});
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [when, setWhen] = useState<When>(initialWhen(milestone));
  const [date, setDate] = useState(milestone?.date ?? '');
  const [ageMin, setAgeMin] = useState<number | null>(milestone?.ageMin ?? startAge);
  const [ageMax, setAgeMax] = useState<number | null>(
    milestone && milestone.ageMax !== milestone.ageMin ? milestone.ageMax : null,
  );
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [linked, setLinked] = useState<string[]>(milestone?.memoryIds ?? []);
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oldest = profile?.currentAge ?? 120;

  const around = when === 'age' ? ageMin : (milestone?.ageMin ?? null);
  const choices = useMemo(() => {
    const words = filter.trim().toLowerCase();
    const list = (memories ?? []).filter(
      (m) =>
        !words || m.title.toLowerCase().includes(words) || m.excerpt.toLowerCase().includes(words),
    );
    const distance = (age: number | null) =>
      around === null || age === null ? 99 : Math.abs(age - around);
    return list
      .sort((a, b) => distance(a.temporal.ageMin) - distance(b.temporal.ageMin))
      .slice(0, words ? 12 : 8);
  }, [memories, filter, around]);

  const datePattern = when === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  const placed = when === 'age' ? ageMin !== null : datePattern.test(date);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      title: title.trim(),
      date: when === 'age' ? null : date,
      ageMin: when === 'age' ? ageMin : null,
      ageMax: when === 'age' ? (ageMax ?? ageMin) : null,
      description: description.trim() || null,
      memoryIds: linked,
    };
    try {
      if (milestone) await api.put(`/milestones/${milestone.id}`, body);
      else await api.post('/milestones', body);
      invalidate();
      toast(milestone ? 'Milestone updated.' : 'Milestone added to your life map.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!milestone) return;
    setBusy(true);
    try {
      await api.delete(`/milestones/${milestone.id}`);
      invalidate();
      toast('Milestone removed. Its memories are still here.');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const nudge = (by: number) => {
    if (ageMin === null) return;
    const next = Math.min(oldest, Math.max(0, ageMin + by));
    const span = ageMax === null ? null : ageMax - ageMin;
    setAgeMin(next);
    if (span !== null) setAgeMax(Math.min(oldest, next + span));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={milestone ? 'Milestone' : 'New milestone'}
      description="A turning point in your life. It sits on your life map at the time it happened, and memories can hang off it."
      width="max-w-xl"
      footer={
        confirming ? (
          <>
            <p className="mr-auto text-sm font-semibold">Delete “{milestone?.title}”?</p>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void remove()}>
              Delete
            </Button>
          </>
        ) : (
          <>
            {milestone && (
              <Button
                variant="ghost"
                icon={<Trash2 className="size-4" />}
                className="mr-auto !text-rose-deep"
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!title.trim() || !placed || busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">What happened</span>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="We moved into the apartment on Elm Street"
            maxLength={120}
            autoFocus
          />
        </label>
        {!milestone && !title.trim() && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-soft">
              Or start from one of these, then make it yours:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setTitle(idea)}
                  className="rounded-full bg-linen px-3 py-1 text-xs font-semibold text-ink-soft transition hover:text-ink"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-sm font-bold">When</p>
          <Segmented
            label="How you know when it happened"
            size="sm"
            value={when}
            onChange={(next) => {
              setWhen(next);
              if (next === 'month' && date.length > 7) setDate(date.slice(0, 7));
            }}
            options={[
              { value: 'age', label: 'Roughly, by age' },
              { value: 'month', label: 'Month and year' },
              { value: 'date', label: 'Exact date' },
            ]}
          />
          <div className="mt-3">
            {when === 'age' ? (
              <div className="flex flex-wrap items-center gap-3">
                <Stepper label="Age" value={ageMin} onChange={setAgeMin} max={oldest} />
                <span className="text-sm text-ink-soft">to</span>
                <Stepper
                  label="Until age"
                  value={ageMax}
                  onChange={(v) =>
                    setAgeMax(v !== null && ageMin !== null && v < ageMin ? ageMin : v)
                  }
                  max={oldest}
                />
                <span className="text-xs text-ink-soft">
                  Leave the second one empty if it was one year.
                </span>
              </div>
            ) : (
              <TextInput
                type={when === 'month' ? 'month' : 'date'}
                aria-label={when === 'month' ? 'Month and year' : 'Date'}
                value={when === 'month' ? date.slice(0, 7) : date.length === 10 ? date : ''}
                onChange={(e) => setDate(e.target.value)}
                className="w-56"
              />
            )}
          </div>
          {milestone && when === 'age' && ageMin !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-soft">Move it:</span>
              <Button size="sm" variant="ghost" onClick={() => nudge(-1)} disabled={ageMin <= 0}>
                A year earlier
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => nudge(1)}
                disabled={ageMin >= oldest}
              >
                A year later
              </Button>
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">A few words about it (optional)</span>
          <TextArea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
          />
        </label>

        <div>
          <p className="mb-1.5 text-sm font-bold">Memories that belong with it</p>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <TextInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a memory"
              aria-label="Find a memory"
              className="pl-9"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ...(memories ?? []).filter((m) => linked.includes(m.id) && !choices.includes(m)),
              ...choices,
            ].map((m) => {
              const on = linked.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setLinked((l) => (on ? l.filter((x) => x !== m.id) : [...l, m.id]))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${on ? 'bg-gold-deep text-abyss' : 'bg-linen text-ink-soft hover:text-ink'}`}
                >
                  {m.title}
                  <span className="ml-1 opacity-70">
                    {m.temporal.ageMin !== null ? `· ${m.temporal.ageMin}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-deep">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
