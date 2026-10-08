import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { mediaUrl, PLACEHOLDER_IMAGE } from '@/lib/media-url';
import type { PhotoResponse } from '@/types/api';

/** 1 large + 4 small, with a lightbox that traps focus and supports keyboard arrows. */
export const PhotoGallery: React.FC<{
  photos: PhotoResponse[];
  title: string;
}> = ({ photos, title }) => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(photos.length - 1, value + 1));
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, photos.length]);

  if (photos.length === 0) {
    return (
      // A bare div has no role, so aria-label was never exposed. role="img" makes the
      // placeholder announce itself as the "no photos" image it is.
      <div
        role="img"
        aria-label="No photos yet"
        className="aspect-[16/9] w-full rounded-card bg-neutral-soft"
      />
    );
  }

  const ordered = [...photos].sort((a, b) => (a.isCover ? -1 : b.isCover ? 1 : a.sortOrder - b.sortOrder));
  const [cover, ...rest] = ordered;
  const small = rest.slice(0, 4);

  return (
    <section aria-label={`Photos of ${title}`} className="relative">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4 sm:grid-rows-2 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
          className="group relative col-span-1 aspect-[16/9] overflow-hidden rounded-l-card sm:col-span-2 sm:row-span-2 sm:aspect-auto"
        >
          <img
            src={mediaUrl(cover.url) ?? PLACEHOLDER_IMAGE}
            alt={`${title} photo 1`}
            className="h-full w-full object-cover"
          />
        </button>
        {small.map((photo, indexInGrid) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => {
              setIndex(indexInGrid + 1);
              setOpen(true);
            }}
            className="hidden overflow-hidden sm:block"
          >
            <img
              src={mediaUrl(photo.url) ?? PLACEHOLDER_IMAGE}
              alt={`${title} photo ${indexInGrid + 2}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="absolute bottom-4 right-4 bg-surface"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        <Expand className="h-4 w-4" aria-hidden />
        Show all {photos.length} photos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-w-4xl bg-surface p-4">
          <DialogTitle className="sr-only">Photos of {title}</DialogTitle>
          <img
            src={mediaUrl(ordered[index]?.url) ?? PLACEHOLDER_IMAGE}
            alt={`${title} photo ${index + 1} of ${ordered.length}`}
            className="max-h-[75vh] w-full rounded-card object-contain"
          />
          <div className="mt-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
            <span className="text-sm text-muted tabular">
              {index + 1} / {ordered.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndex((value) => Math.min(ordered.length - 1, value + 1))}
              disabled={index === ordered.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3"
            onClick={() => setOpen(false)}
            aria-label="Close photos"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export const PhotoThumb: React.FC<{
  src: string | null;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => (
  <div className={cn('overflow-hidden rounded-card bg-neutral-soft', className)}>
    <img src={mediaUrl(src) ?? PLACEHOLDER_IMAGE} alt={alt} loading="lazy" className="h-full w-full object-cover" />
  </div>
);