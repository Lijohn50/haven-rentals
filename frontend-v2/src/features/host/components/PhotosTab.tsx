import React, { useCallback, useRef, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ApiError } from '@/api/errors';
import { useListingMutations } from '@/features/listings/api';
import { Button, Card, Field, InlineAlert, Textarea } from '@/components/ui';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { BRAND } from '@/config/brand';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { GripVertical, ImagePlus, Link2, Upload } from 'lucide-react';
import type { ListingResponse, PhotoResponse } from '@/types/api';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

// Same pattern the backend validates against (PhotoLinkRequest.url).
const CLOUDINARY_URL_PATTERN = /^https:\/\/[a-z0-9.-]+\.cloudinary\.com\/.+/;

function preflight(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!ACCEPTED.includes(file.type)) return resolve('Unsupported format. Use JPEG, PNG or WebP.');
    if (file.size > BRAND.maxPhotoBytes) return resolve(`File is larger than ${BRAND.maxPhotoBytes / (1024 * 1024)} MB.`);
    createImageBitmap(file).then((bitmap) => {
      if (bitmap.width < BRAND.photoMinSide || bitmap.height < BRAND.photoMinSide) return resolve(`Image must be at least ${BRAND.photoMinSide}×${BRAND.photoMinSide} px.`);
      if (bitmap.width > BRAND.photoMaxSide || bitmap.height > BRAND.photoMaxSide) return resolve(`Image must be at most ${BRAND.photoMaxSide}×${BRAND.photoMaxSide} px.`);
      resolve(null);
    }).catch(() => resolve('Could not read the image file.'));
  });
}

function SortablePhoto({ photo, position, onMakeCover, onDelete, disabled }: { photo: PhotoResponse; position: number; onMakeCover: () => void; onDelete: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: `translate3d(0, ${transform?.y ?? 0}px, 0)`, transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative flex items-center gap-3 rounded-control border border-line bg-bg p-2">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted hover:text-ink" aria-label={`Reorder photo ${position}`}>
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <PhotoThumb src={photo.url} alt="" className="h-16 w-24 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">Photo {position} · {photo.width}×{photo.height} px</p>
      </div>
      <div className="flex items-center gap-2">
        {photo.isCover && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark">Cover</span>}
        <Button variant="outline" size="sm" onClick={onMakeCover} disabled={disabled || photo.isCover}>Make cover</Button>
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete} disabled={disabled}>Delete</Button>
      </div>
    </div>
  );
}

export const PhotosTab: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const mutations = useListingMutations(listing.id);
  const [dragOver, setDragOver] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [photoUrls, setPhotoUrls] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [linkProgress, setLinkProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const ordered = [...listing.photos].sort((a, b) => a.sortOrder - b.sortOrder);
  const atMax = ordered.length >= BRAND.maxPhotosPerListing;
  const busy = uploadProgress !== null || linkProgress !== null;

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || atMax) return;
    setPhotoError(null);
    const fileArray = Array.from(files);
    let added = 0;
    setUploadProgress({ done: 0, total: fileArray.length });
    for (let i = 0; i < fileArray.length; i += 1) {
      // `added` tracks this batch so the max check stays accurate mid-upload.
      if (ordered.length + added >= BRAND.maxPhotosPerListing) {
        setPhotoError(`You can upload at most ${BRAND.maxPhotosPerListing} photos.`);
        break;
      }
      const file = fileArray[i];
      const err = await preflight(file);
      if (err) { setPhotoError(err); setUploadProgress({ done: i + 1, total: fileArray.length }); continue; }
      try {
        await mutations.uploadPhoto.mutateAsync({ id: listing.id, file });
        added += 1;
      } catch (error) {
        const api = error instanceof ApiError ? error : null;
        setPhotoError(api?.detail ?? 'Upload failed');
      }
      setUploadProgress({ done: i + 1, total: fileArray.length });
    }
    setUploadProgress(null);
  }, [listing.id, mutations.uploadPhoto, ordered.length, atMax]);

  /**
   * Links are added one request per line, exactly like local uploads are one
   * request per file, so a pasted list behaves like the multi-file picker.
   * Successfully added lines are dropped from the box; failed lines stay so
   * they can be fixed and retried.
   */
  const handleAddLinks = useCallback(async () => {
    const lines = photoUrls
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    if (lines.length === 0 || atMax) return;
    setPhotoError(null);
    const invalid = lines.find((line) => !CLOUDINARY_URL_PATTERN.test(line));
    if (invalid) {
      setPhotoError('Every line must be an https Cloudinary URL.');
      return;
    }
    let added = 0;
    const remaining: string[] = [];
    setLinkProgress({ done: 0, total: lines.length });
    for (let i = 0; i < lines.length; i += 1) {
      // `added` tracks this batch so the max check stays accurate mid-add.
      if (ordered.length + added >= BRAND.maxPhotosPerListing) {
        setPhotoError(`You can upload at most ${BRAND.maxPhotosPerListing} photos.`);
        break;
      }
      try {
        await mutations.addPhotoLink.mutateAsync({ id: listing.id, url: lines[i] });
        added += 1;
      } catch (error) {
        const api = error instanceof ApiError ? error : null;
        setPhotoError(api?.detail ?? 'Could not add a photo. Check the URL and try again.');
        remaining.push(lines[i]);
      }
      setLinkProgress({ done: i + 1, total: lines.length });
    }
    setLinkProgress(null);
    setPhotoUrls(remaining.join('\n'));
    if (added > 0) {
      toast.success(added === 1 ? 'Photo added' : `${added} photos added`);
    }
  }, [listing.id, mutations.addPhotoLink, ordered.length, atMax, photoUrls]);

  // dnd-kit types ids as UniqueIdentifier (string | number), so the handler has to accept
  // that and narrow, rather than narrowing the parameter type and failing to match.
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((p) => p.id === Number(active.id));
    const newIndex = ordered.findIndex((p) => p.id === Number(over.id));
    const next = [...ordered];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    const photoIds = next.map((p) => p.id);
    mutations.reorderPhotos.mutate({ id: listing.id, photoIds });
  };

  const onDelete = async (photoId: number) => {
    if (ordered.length - 1 < BRAND.minPhotosToSubmit) {
      setPhotoError(`You must keep at least ${BRAND.minPhotosToSubmit} photos.`);
      return;
    }
    try {
      await mutations.deletePhoto.mutateAsync({ id: listing.id, photoId });
      toast.success('Photo removed');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.code === 'BUSINESS_RULE_VIOLATION') setPhotoError(`Keep at least ${BRAND.minPhotosToSubmit} photos.`);
      else setPhotoError(api?.detail ?? 'Could not delete photo');
    }
  };

  const openFilePicker = () => { if (!atMax && !busy) inputRef.current?.click(); };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Photos</h2>
          <p className="mt-0.5 text-sm text-muted">
            {ordered.length} of {BRAND.maxPhotosPerListing} uploaded · at least {BRAND.minPhotosToSubmit} required to submit
          </p>
        </div>
        <div className="flex rounded-control border border-line p-1" role="tablist" aria-label="Photo source">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'upload'}
            onClick={() => setMode('upload')}
            className={cn('flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors', mode === 'upload' ? 'bg-primary text-white' : 'text-muted hover:text-ink')}
          >
            <Upload className="h-4 w-4" aria-hidden /> Upload
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'link'}
            onClick={() => setMode('link')}
            className={cn('flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors', mode === 'link' ? 'bg-primary text-white' : 'text-muted hover:text-ink')}
          >
            <Link2 className="h-4 w-4" aria-hidden /> Cloudinary link
          </button>
        </div>
      </div>

      {photoError && <InlineAlert tone="danger" className="mt-3">{photoError}</InlineAlert>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { void handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />

      {mode === 'upload' ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photos"
          onClick={openFilePicker}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !atMax && !busy) { e.preventDefault(); openFilePicker(); } }}
          className={cn(
            'mt-4 flex flex-col items-center justify-center rounded-card border-2 border-dashed p-8 text-center transition-colors',
            dragOver ? 'border-primary bg-primary-soft/20' : 'border-line hover:border-primary/50',
            (atMax || busy) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!atMax && !busy) void handleFiles(e.dataTransfer.files); }}
        >
          <ImagePlus className="h-8 w-8 text-muted" aria-hidden />
          {uploadProgress ? (
            <p className="mt-2 text-sm text-muted">Uploading {uploadProgress.done} of {uploadProgress.total}…</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">Drag and drop photos here, or click to browse.</p>
              <p className="mt-1 text-xs text-muted">JPEG, PNG or WebP · {BRAND.photoMinSide}×{BRAND.photoMinSide} to {BRAND.photoMaxSide}×{BRAND.photoMaxSide} px · max {BRAND.maxPhotoBytes / (1024 * 1024)} MB each</p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Field
            label="Photo URLs"
            htmlFor="photo-urls"
            hint="One Cloudinary URL per line — every line is added as its own photo."
            error={photoError}
          >
            <Textarea
              id="photo-urls"
              placeholder={'https://res.cloudinary.com/<cloud>/image/upload/<public-id>.jpg'}
              value={photoUrls}
              onChange={(e) => setPhotoUrls(e.target.value)}
              hasError={Boolean(photoError)}
              className="min-h-[120px]"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void handleAddLinks()}
              disabled={!photoUrls.trim() || atMax}
              loading={mutations.addPhotoLink.isPending}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Add photos
            </Button>
            {linkProgress && (
              <span className="text-sm text-muted">
                Adding {linkProgress.done} of {linkProgress.total}…
              </span>
            )}
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-line p-6 text-center">
          <p className="text-sm text-muted">No photos uploaded yet.</p>
          <p className="mt-1 text-xs text-muted">Add at least {BRAND.minPhotosToSubmit} to submit your listing.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ordered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 flex flex-col gap-2">
              {ordered.map((photo, index) => (
                <SortablePhoto
                  key={photo.id}
                  photo={photo}
                  position={index + 1}
                  onMakeCover={async () => { try { await mutations.setCover.mutateAsync({ id: listing.id, photoId: photo.id }); toast.success('Cover updated'); } catch { toast.error('Could not set cover'); } }}
                  onDelete={() => onDelete(photo.id)}
                  disabled={busy || mutations.reorderPhotos.isPending || mutations.addPhotoLink.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  );
};
