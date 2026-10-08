import React, { useEffect, useRef, useState } from 'react';
import { useListingDescriptionDraft, isAiUnavailable } from '@/features/ai/api';
import { Button } from '@/components/ui';
import { ApiError } from '@/api/errors';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'haven.ai.descriptionHidden';

export const AiDescriptionHelper: React.FC<{
  propertyType: 'APARTMENT' | 'HOUSE' | 'VILLA' | 'CABIN' | 'CONDO' | 'STUDIO' | 'OTHER';
  city: string;
  onUse: (text: string) => void;
}> = ({ propertyType, city, onUse }) => {
  const draft = useListingDescriptionDraft();
  const [bullets, setBullets] = useState<string[]>(['']);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [rateCooldown, setRateCooldown] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  if (hidden) return null;

  const generate = async () => {
    const cleaned = bullets.filter((b) => b.trim().length >= 3).slice(0, 15);
    if (cleaned.length === 0) return;
    try {
      const res = await draft.mutateAsync({ propertyType, city, bullets: cleaned });
      setDraftText(res.text);
    } catch (error) {
      if (isAiUnavailable(error)) {
        setHidden(true);
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === 'RATE_LIMITED') {
          setRateCooldown(error.retryAfter);
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = window.setInterval(() => {
            setRateCooldown((c) => {
              if (c <= 1) {
                if (timerRef.current) window.clearInterval(timerRef.current);
                return 0;
              }
              return c - 1;
            });
          }, 1000) as unknown as number;
          return;
        }
      }
    }
  };

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  };

  const disabled = bullets.filter((b) => b.trim()).length === 0 || draft.isPending || rateCooldown > 0;

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">AI draft. Review before publishing.</p>
      {!draftText ? (
        <div className="mt-3 flex flex-col gap-3">
          {bullets.map((bullet, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-muted tabular">•</span>
              <input
                type="text"
                value={bullet}
                maxLength={200}
                onChange={(e) => {
                  const next = [...bullets];
                  next[index] = e.target.value;
                  setBullets(next);
                }}
                placeholder="A selling point (3–200 characters)"
                className="flex-1 rounded-control border border-line bg-bg px-3 py-1.5 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setBullets(bullets.filter((_, i) => i !== index))}
                disabled={bullets.length <= 1}
                aria-label="Remove bullet"
              >
                ×
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={generate}
              loading={draft.isPending}
              disabled={disabled}
            >
              Generate draft
            </Button>
            {bullets.length < 15 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBullets([...bullets, ''])}
                disabled={rateCooldown > 0}
              >
                Add bullet
              </Button>
            )}
            {rateCooldown > 0 && (
              <span className="text-xs text-muted">Retry in {rateCooldown}s</span>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={dismiss} className="ml-auto">
              Dismiss
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="whitespace-pre-line text-sm text-ink">{draftText}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { onUse(draftText); setDraftText(null); }}>
              Use this draft
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDraftText(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
