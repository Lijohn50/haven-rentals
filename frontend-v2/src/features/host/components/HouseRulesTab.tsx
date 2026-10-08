import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useListingMutations } from '@/features/listings/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Button, Card, InlineAlert, Input, Skeleton, TraceId, applyFieldErrors } from '@/components/ui';
import { houseRuleSchema } from '@/features/host/schemas';
import { ApiError } from '@/api/errors';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

type Rule = { text: string; sortOrder: number };

const schema = z.object({
  rules: z.array(houseRuleSchema).max(15, 'You can add at most 15 rules'),
});
type Values = z.infer<typeof schema>;

export const HouseRulesTab: React.FC<{ listing: { id: number; houseRules: { text: string; sortOrder: number }[] } }> = ({ listing }) => {
  const mutations = useListingMutations(listing.id);
  const form = useForm<Values>({ defaultValues: { rules: listing.houseRules.length ? listing.houseRules : [{ text: '', sortOrder: 0 }] } });

  React.useEffect(() => {
    form.reset({ rules: listing.houseRules.length ? listing.houseRules : [{ text: '', sortOrder: 0 }] });
  }, [listing.houseRules, form]);

  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const onSubmit = async (values: Values) => {
    const rules = values.rules.filter((r) => r.text.trim()).map((r, idx) => ({ text: r.text.trim(), sortOrder: idx }));
    if (rules.length === 0) {
      setMessage('Add at least one house rule.');
      return;
    }
    setMessage(null);
    setTrace(null);
    try {
      await mutations.setHouseRules.mutateAsync({ id: listing.id, rules });
      toast.success('House rules updated');
      form.reset({ rules });
    } catch (error) {
      const setFieldError = (name: string, text: string) => form.setError(name as keyof Values, { message: text });
      const unmatched = applyFieldErrors(error, setFieldError, ['rules']);
      setMessage(unmatched[0] ?? (error instanceof ApiError ? error.detail : 'Could not save house rules.'));
      setTrace(error);
    }
  };

  const rules = form.watch('rules');

  const addRule = () => {
    form.setValue('rules', [...rules, { text: '', sortOrder: rules.length }], { shouldDirty: true });
  };

  const removeRule = (index: number) => {
    form.setValue('rules', rules.filter((_, i) => i !== index), { shouldDirty: true });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...rules];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    next.forEach((r, i) => (r.sortOrder = i));
    form.setValue('rules', next, { shouldDirty: true });
  };

  const moveDown = (index: number) => {
    if (index === rules.length - 1) return;
    const next = [...rules];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    next.forEach((r, i) => (r.sortOrder = i));
    form.setValue('rules', next, { shouldDirty: true });
  };

  const { isSubmitting } = form.formState;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink">House rules</h2>
      <p className="mt-1 text-sm text-muted">Up to 15 rules, each 200 characters or fewer. Guests see these before booking.</p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {message && (
          <InlineAlert tone="danger">
            {message}
            <TraceId error={trace} className="mt-1 block" />
          </InlineAlert>
        )}

        {rules.map((rule, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2 text-xs text-muted tabular">{index + 1}.</span>
            <div className="flex-1">
              <Input
                value={rule.text}
                maxLength={200}
                onChange={(e) => {
                  const next = [...rules];
                  next[index] = { text: e.target.value, sortOrder: index };
                  form.setValue('rules', next, { shouldDirty: true });
                }}
                placeholder="e.g. No smoking inside"
                aria-label={`Rule ${index + 1}`}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveUp(index)} disabled={index === 0} aria-label="Move up">
                ↑
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveDown(index)} disabled={index === rules.length - 1} aria-label="Move down">
                ↓
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => removeRule(index)} aria-label="Remove rule">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {rules.length < 15 && (
          <Button type="button" variant="outline" size="sm" onClick={addRule}>
            <Plus className="h-4 w-4" aria-hidden />
            Add rule
          </Button>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting || mutations.setHouseRules.isPending}>
            Save rules
          </Button>
        </div>
      </form>
    </Card>
  );
};
