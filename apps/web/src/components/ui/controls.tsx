import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useSound } from '../../lib/sound/SoundProvider';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode; hint?: string }>;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const { play } = useSound();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-linen/70 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            onClick={() => {
              play('tap');
              onChange(option.value);
            }}
            className={`rounded-full font-semibold transition-all ${size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${
              active ? 'bg-paper text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  const { play } = useSound();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => {
          play('tap');
          onChange(!checked);
        }}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-all ${checked ? 'bg-gradient-to-r from-lavender to-magenta shadow-[0_0_18px_-4px_var(--color-magenta)]' : 'bg-linen'}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-snow shadow transition-all ${checked ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

const width = (className?: string) => (className && /(^|\s)w-/.test(className) ? '' : 'w-full');
const pad = (className?: string) => (className && /(^|\s)(py-|h-)/.test(className) ? '' : 'py-2.5');

const inputBase =
  'rounded-2xl border border-ink/12 bg-paper px-4 text-ink placeholder:text-ink-faint transition focus:border-lavender-deep focus:outline-none focus:ring-4 focus:ring-lavender/40';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputBase} ${width(props.className)} ${pad(props.className)} ${props.className ?? ''}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputBase} ${width(props.className)} ${pad(props.className)} leading-relaxed ${props.className ?? ''}`}
    />
  );
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputBase} ${width(props.className)} ${pad(props.className)} appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10 ${props.className ?? ''}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23625b72' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 120,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const { play } = useSound();
  const set = (next: number) => {
    play('tap');
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div
      className="inline-flex items-center rounded-full border border-ink/12 bg-paper"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Lower ${label}`}
        className="size-10 rounded-full text-lg font-bold text-ink-soft hover:bg-ink/5"
        onClick={() => set((value ?? min) - 1)}
      >
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        className="w-12 bg-transparent text-center font-display text-xl font-semibold focus:outline-none"
        value={value ?? ''}
        placeholder="?"
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(
            event.target.value === ''
              ? null
              : Number.isFinite(parsed)
                ? Math.min(max, Math.max(min, parsed))
                : value,
          );
        }}
      />
      <button
        type="button"
        aria-label={`Raise ${label}`}
        className="size-10 rounded-full text-lg font-bold text-ink-soft hover:bg-ink/5"
        onClick={() => set((value ?? min) + 1)}
      >
        +
      </button>
    </div>
  );
}
