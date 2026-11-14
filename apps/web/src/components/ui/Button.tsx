import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { useSound } from '../../lib/sound/SoundProvider';
import type { Effect } from '../../lib/sound/engine';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-aurora active:translate-y-px disabled:saturate-0',
  secondary: 'paper text-ink hover:border-white/20 hover:bg-white/8 active:translate-y-px',
  ghost: 'text-ink-soft hover:bg-white/6 hover:text-ink',
  danger:
    'bg-rose/85 text-snow shadow-[0_0_30px_-10px_rgb(251_113_133/0.9)] hover:bg-rose active:translate-y-px',
  soft: 'bg-lavender/20 text-lavender-deep ring-1 ring-lavender/30 hover:bg-lavender/30',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-full',
  md: 'h-11 px-5 text-[0.95rem] gap-2 rounded-full',
  lg: 'h-14 px-7 text-base gap-2.5 rounded-full',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  sound?: Effect | false;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    sound = 'tap',
    className = '',
    children,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const { play } = useSound();
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      onClick={(event) => {
        if (sound) play(sound);
        onClick?.(event);
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  const { play } = useSound();
  return (
    <Link
      viewTransition
      className={buttonClass(variant, size, className)}
      onClick={() => play('tap')}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  sound = 'tap',
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; sound?: Effect | false }) {
  const { play } = useSound();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-ink/6 hover:text-ink ${className}`}
      onClick={(event) => {
        if (sound) play(sound);
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
