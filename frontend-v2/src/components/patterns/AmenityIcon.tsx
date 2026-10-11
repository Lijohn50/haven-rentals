import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { amenityIcon } from '@/lib/amenity-icons';
import type { AmenityResponse } from '@/types/api';

export const AmenityIcon: React.FC<{
  name: string;
  icon?: string | null;
  className?: string;
  showLabel?: boolean;
}> = ({ name, icon, className, showLabel = false }) => {
  const Icon = amenityIcon(icon);
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-ink', className)}>
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      {showLabel ? name : <span className="sr-only">{name}</span>}
    </span>
  );
};

export const AmenityGroup: React.FC<{ amenities: AmenityResponse[] }> = ({ amenities }) => {
  const groups = amenities.reduce<Record<string, AmenityResponse[]>>((accumulator, amenity) => {
    const key = amenity.category || 'Other';
    accumulator[key] = [...(accumulator[key] ?? []), amenity];
    return accumulator;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(groups).map(([category, items]) => (
        <div key={category}>
          <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">
            {category}
          </h4>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((amenity) => {
              const Icon = amenityIcon(amenity.icon);
              return (
                <li
                  key={amenity.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-text transition-colors hover:bg-sand"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sand text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="font-medium">{amenity.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

/** Search results only carry amenity *names*, so the preview uses the generic fallback. */
export const AmenityPreview: React.FC<{ names: string[] }> = ({ names }) => {
  if (names.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {names.slice(0, 4).map((name) => (
        <li key={name} className="flex items-center gap-1 text-xs text-muted">
          <Check className="h-3 w-3" aria-hidden />
          {name}
        </li>
      ))}
    </ul>
  );
};