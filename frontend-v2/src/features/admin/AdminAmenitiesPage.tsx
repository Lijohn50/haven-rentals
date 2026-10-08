import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { useAdminMutations } from '@/features/host/api';
import { useAmenities } from '@/features/search/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ROUTES } from '@/config/routes';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Select,
  Skeleton,
  TraceId,
  applyFieldErrors,
  type Column,
} from '@/components/ui';
import { amenityIcon } from '@/lib/amenity-icons';
import type { AmenityResponse } from '@/types/api';

const ICON_KEYS = [
  'wifi',
  'kitchen',
  'coffee',
  'air-conditioning',
  'heating',
  'washing-machine',
  'tv',
  'desk',
  'parking',
  'pool',
  'hot-tub',
  'bbq',
  'balcony',
  'beach',
  'smoke-alarm',
  'first-aid',
  'fire-extinguisher',
  'crib',
  'high-chair',
  'dumbbell',
  'elevator',
  'hair-dryer',
  'iron',
  'key',
  'garden',
  'view',
  'bike',
  'bed',
];

const CUSTOM = '__custom__';

const amenitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters')
    .max(60, 'Use at most 60 characters'),
  category: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters')
    .max(60, 'Use at most 60 characters'),
  icon: z.string().trim().min(1, 'Choose an icon or type a key'),
});

type AmenityValues = z.infer<typeof amenitySchema>;

const ICON_CHIP =
  'inline-flex h-8 w-8 items-center justify-center rounded-control bg-primary-soft text-primary-dark';

const IconPreview: React.FC<{ iconKey: string | null | undefined; label: string }> = ({
  iconKey,
  label,
}) => {
  const Icon = amenityIcon(iconKey);
  return (
    <span className="flex items-center gap-2">
      <span className={ICON_CHIP}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="tabular text-xs text-muted">{iconKey ?? 'no key'} · {label}</span>
    </span>
  );
};

export const AdminAmenitiesPage: React.FC = () => {
  useDocumentTitle('Amenities');

  const amenities = useAmenities();
  const admin = useAdminMutations();

  const [editing, setEditing] = useState<AmenityResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<AmenityResponse | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [customIcon, setCustomIcon] = useState('');

  const rows = amenities.data ?? [];

  const form = useForm<AmenityValues>({
    resolver: zodResolver(amenitySchema),
    defaultValues: { name: '', category: '', icon: ICON_KEYS[0] },
  });

  const iconValue = form.watch('icon');
  const nameValue = form.watch('name') ?? '';
  const categoryValue = form.watch('category') ?? '';

  const openAdd = () => {
    setCustomIcon('');
    form.reset({ name: '', category: '', icon: ICON_KEYS[0] });
    setEditing(null);
    setActionError(null);
    setDialogOpen(true);
  };

  const openEdit = (amenity: AmenityResponse) => {
    const key = amenity.icon ?? '';
    const known = ICON_KEYS.includes(key);
    setCustomIcon(known ? '' : key);
    form.reset({
      name: amenity.name,
      category: amenity.category,
      icon: known ? key : CUSTOM,
    });
    setEditing(amenity);
    setActionError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setActionError(null);
    form.reset();
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setActionError(null);
    const duplicate = rows.some(
      (row) =>
        row.id !== editing?.id && row.name.toLowerCase() === values.name.trim().toLowerCase()
    );
    if (duplicate) {
      form.setError('name', { message: 'Another amenity already uses that name' });
      return;
    }
    try {
      if (editing) {
        await admin.updateAmenity.mutateAsync({
          id: editing.id,
          payload: { name: values.name.trim(), category: values.category.trim(), icon: values.icon.trim() },
        });
        toast.success('Amenity updated.');
      } else {
        await admin.createAmenity.mutateAsync({
          name: values.name.trim(),
          category: values.category.trim(),
          icon: values.icon.trim(),
        });
        toast.success('Amenity added.');
      }
      closeDialog();
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => form.setError(name as keyof AmenityValues, { message }),
        ['name', 'category', 'icon']
      );
      setActionError(error);
      if (error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE') {
        toast.error('Another amenity already uses that name.');
        return;
      }
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  });

  const onDelete = async () => {
    if (!deleting) return;
    setActionError(null);
    try {
      await admin.deleteAmenity.mutateAsync(deleting.id);
      setDeleting(null);
      toast.success(`${deleting.name} was removed, or deactivated if it was in use.`);
    } catch (error) {
      setActionError(error);
      toast.error(error instanceof ApiError ? error.detail : 'That amenity could not be removed.');
    }
  };

  const columns: Column<AmenityResponse>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    { key: 'category', header: 'Category', render: (row) => row.category },
    {
      key: 'icon',
      header: 'Icon',
      render: (row) => <IconPreview iconKey={row.icon} label={row.name} />,
    },
    {
      key: 'usage',
      header: 'Usage',
      // The public endpoint returns no usage count, so this stays empty by contract.
      render: () => <span className="text-muted">—</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <span className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Amenities' }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Amenities</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            The same list guests see: only amenities active today are returned. The public list is
            cached server-side for an hour, so guests may see a change within the hour.
          </p>
        </div>
        <Button onClick={openAdd}>Add amenity</Button>
      </div>

      {amenities.isLoading && <Skeleton className="h-48 w-full" />}

      {amenities.isError && (
        <ErrorState error={amenities.error} onRetry={() => void amenities.refetch()} />
      )}

      {amenities.data && rows.length === 0 && (
        <EmptyState
          title="No active amenities"
          description="Add the first one so hosts can offer it on their listings."
          action={<Button onClick={openAdd}>Add amenity</Button>}
        />
      )}

      {rows.length > 0 && (
        <DataTable caption="Amenities" columns={columns} rows={rows} getRowKey={(row) => row.id} />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add an amenity'}</DialogTitle>
          <DialogDescription>
            Names must be unique, ignoring case. The icon key is free text: anything unrecognised
            falls back to a neutral check mark on the listing page.
          </DialogDescription>

          <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Field
              label="Name"
              htmlFor="amenity-name"
              required
              hint={`${nameValue.length}/60 characters.`}
              error={form.formState.errors.name?.message}
            >
              <Input
                id="amenity-name"
                maxLength={60}
                hasError={Boolean(form.formState.errors.name)}
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register('name')}
              />
            </Field>

            <Field
              label="Category"
              htmlFor="amenity-category"
              required
              hint={`${categoryValue.length}/60 characters. For example Kitchen, Safety, Outdoor.`}
              error={form.formState.errors.category?.message}
            >
              <Input
                id="amenity-category"
                maxLength={60}
                hasError={Boolean(form.formState.errors.category)}
                aria-invalid={Boolean(form.formState.errors.category)}
                {...form.register('category')}
              />
            </Field>

            <Field
              label="Icon"
              htmlFor="amenity-icon"
              required
              error={form.formState.errors.icon?.message}
            >
              <Select
                id="amenity-icon"
                value={iconValue}
                hasError={Boolean(form.formState.errors.icon)}
                aria-invalid={Boolean(form.formState.errors.icon)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === CUSTOM) {
                    setCustomIcon('');
                    form.setValue('icon', '', { shouldValidate: true });
                  } else {
                    form.setValue('icon', value, { shouldValidate: true });
                  }
                }}
              >
                {ICON_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
                <option value={CUSTOM}>Other (type a key)</option>
              </Select>
            </Field>

            {iconValue === CUSTOM && (
              <Field
                label="Icon key"
                htmlFor="amenity-icon-key"
                required
                hint="Free text. An unrecognised key falls back to a neutral check mark."
              >
                <Input
                  id="amenity-icon-key"
                  value={customIcon}
                  onChange={(event) => {
                    setCustomIcon(event.target.value);
                    form.setValue('icon', event.target.value, { shouldValidate: true });
                  }}
                />
              </Field>
            )}

            <div className="flex items-center gap-3 rounded-control bg-bg px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-muted">Preview</span>
              <IconPreview
                iconKey={iconValue === CUSTOM ? customIcon : iconValue}
                label={nameValue === '' ? 'this amenity' : nameValue}
              />
            </div>

            {actionError != null && (
              <InlineAlert tone="danger">
                {actionError instanceof ApiError
                  ? actionError.detail
                  : 'The amenity could not be saved.'}
                <TraceId error={actionError} className="mt-1 block" />
              </InlineAlert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                {editing ? 'Save amenity' : 'Add amenity'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>
            If this amenity is in use it will be deactivated instead, so existing listings keep it
            while new ones cannot select it.
          </DialogDescription>

          {actionError != null && (
            <InlineAlert tone="danger" className="mt-4">
              {actionError instanceof ApiError
                ? actionError.detail
                : 'That amenity could not be removed.'}
              <TraceId error={actionError} className="mt-1 block" />
            </InlineAlert>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={admin.deleteAmenity.isPending}
              onClick={() => void onDelete()}
            >
              Delete amenity
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};