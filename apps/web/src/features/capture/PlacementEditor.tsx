import type { Season, TemporalDto } from '@living-draft/contracts';
import { ageOnDate, MONTH_NAMES, seasonForMonth } from '@living-draft/engine';
import { Quote } from 'lucide-react';
import { useProfile } from '../../api/hooks';
import { CertaintyMark } from '../../components/memory/bits';
import { Select, Stepper, TextInput, Toggle } from '../../components/ui/controls';
import { finalizeTemporal } from './placement';

export function PlacementEditor({
  value,
  onChange,
  conflicts = [],
}: {
  value: TemporalDto;
  onChange: (value: TemporalDto) => void;
  conflicts?: string[];
}) {
  const { data: profile } = useProfile();
  const unknown = value.ageMin === null && !value.year;
  const update = (patch: Partial<TemporalDto>) =>
    onChange(finalizeTemporal({ ...value, ...patch }));
  const pad = (n: number) => String(n).padStart(2, '0');
  const exactValue =
    value.year && value.month && value.day
      ? `${value.year}-${pad(value.month)}-${pad(value.day)}`
      : '';
  const setExact = (iso: string) => {
    if (!iso) {
      update({ year: null, day: null });
      return;
    }
    const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
    const age = profile?.birthDate
      ? ageOnDate(profile.birthDate, new Date(Date.UTC(year, month - 1, day)))
      : null;
    update({
      year,
      month,
      day,
      season: seasonForMonth(month, profile?.hemisphere) ?? value.season,
      approximate: false,
      ...(age !== null && Number.isFinite(age) && age >= 0 ? { ageMin: age, ageMax: age } : {}),
    });
  };
  const range = value.ageMax !== null && value.ageMin !== null && value.ageMax !== value.ageMin;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CertaintyMark temporal={value} />
        {value.placedAges.length > 0 ? (
          <span className="text-sm text-ink-soft">
            Shows up in {value.placedAges.map((a) => `Chapter ${a}`).join(' and ')}
            {value.placedAges.length > 1 ? ', counted once' : ''}
          </span>
        ) : (
          <span className="text-sm text-ink-soft">Stays an open question until you know more</span>
        )}
      </div>

      {value.explanation && <p className="text-sm text-ink-soft">{value.explanation}</p>}

      {value.evidence.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="What I based this on">
          {value.evidence.map((e) => (
            <li
              key={`${e.start}-${e.quote}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold/25 px-3 py-1 text-sm"
              title={e.reason}
            >
              <Quote className="size-3.5 text-gold-deep" aria-hidden="true" />
              <span className="font-semibold">{e.quote}</span>
              <span className="text-xs text-ink-soft">
                · {e.reason.length > 40 ? 'a hint' : e.reason}
              </span>
            </li>
          ))}
        </ul>
      )}

      {conflicts.map((c) => (
        <p key={c} className="rounded-2xl bg-peach/40 px-4 py-2 text-sm text-peach-deep">
          {c}
        </p>
      ))}

      <Toggle
        checked={unknown}
        onChange={(isUnknown) =>
          update(
            isUnknown
              ? {
                  ageMin: null,
                  ageMax: null,
                  year: null,
                  month: null,
                  day: null,
                  approximate: true,
                }
              : { ageMin: 0, ageMax: 0, approximate: true },
          )
        }
        label="I don't know when this was"
        description="It waits as an open question. Nothing gets a made-up date."
      />

      {!unknown && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold sm:col-span-2">
            Exact date, if you know it
            <span className="mt-1.5 flex items-center gap-2">
              <TextInput
                type="date"
                value={exactValue}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExact(e.target.value)}
                className="max-w-56"
              />
              {exactValue && (
                <button
                  type="button"
                  onClick={() => setExact('')}
                  className="text-xs font-semibold text-ink-soft hover:text-ink"
                >
                  Clear
                </button>
              )}
            </span>
            <span className="mt-1 block text-xs font-normal text-ink-soft">
              {profile?.birthDate
                ? 'Sets the age and season for you.'
                : 'Add your birthday in Settings and the age fills itself in.'}
            </span>
          </label>
          <div>
            <p className="mb-1.5 text-sm font-bold">{range ? 'Somewhere between ages' : 'Age'}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Stepper
                label="youngest age"
                value={value.ageMin}
                onChange={(v) => update({ ageMin: v, ageMax: range ? value.ageMax : v })}
              />
              {range && (
                <>
                  <span className="text-ink-soft">and</span>
                  <Stepper
                    label="oldest age"
                    value={value.ageMax}
                    onChange={(v) => update({ ageMax: v })}
                  />
                </>
              )}
            </div>
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-lavender-deep hover:underline"
              onClick={() => update({ ageMax: range ? value.ageMin : (value.ageMin ?? 0) + 1 })}
            >
              {range ? 'It was one age' : 'Could be two ages'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-bold">
              Season
              <Select
                value={value.season ?? ''}
                onChange={(e) => update({ season: (e.target.value || null) as Season | null })}
                className="mt-1.5"
              >
                <option value="">Not sure</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="autumn">Autumn</option>
                <option value="winter">Winter</option>
              </Select>
            </label>
            <label className="text-sm font-bold">
              Month
              <Select
                value={value.month ?? ''}
                onChange={(e) =>
                  update({
                    month: e.target.value ? Number(e.target.value) : null,
                    day: e.target.value ? value.day : null,
                  })
                }
                className="mt-1.5"
              >
                <option value="">Not sure</option>
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <Toggle
            checked={value.approximate}
            onChange={(approximate) => update({ approximate })}
            label="This is an estimate"
            description="Shown with a dashed edge so it never looks more certain than it is."
          />
        </div>
      )}
    </div>
  );
}
