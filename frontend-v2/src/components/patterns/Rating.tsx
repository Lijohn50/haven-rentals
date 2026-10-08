import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRating } from '@/lib/format';

/** Ratings are never conveyed by stars alone: the number and count are always shown. */
export const RatingStars: React.FC<{
  value: number | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ value, size = 'sm', className }) => {
  const rating = value ?? 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${formatRating(value)} out of 5`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          aria-hidden
          className={cn(
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            position <= Math.round(rating) ? 'fill-ink text-ink' : 'text-neutral-soft'
          )}
        />
      ))}
    </span>
  );
};

/** Keyboard-operable star input: a radio group with arrow-key support (architecture 15.1). */
export const StarInput: React.FC<{
  name: string;
  value: number;
  onChange: (value: number) => void;
  legend: string;
  required?: boolean;
}> = ({ name, value, onChange, legend, required }) => (
  <fieldset>
    <legend className="text-sm font-medium text-ink">
      {legend}
      {required && <span className="text-danger ml-0.5">*</span>}
    </legend>
    <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label={legend}>
      {[1, 2, 3, 4, 5].map((position) => (
        <button
          key={position}
          type="button"
          role="radio"
          aria-checked={value === position}
          aria-label={`${position} ${position === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(position)}
          className="p-1"
        >
          <Star
            aria-hidden
            className={cn(
              'h-6 w-6 transition-colors',
              position <= value ? 'fill-ink text-ink' : 'text-neutral-soft'
            )}
          />
        </button>
      ))}
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  </fieldset>
);