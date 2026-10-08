/**
 * Idempotency keys (architecture Appendix D).
 *
 * The same payload always produces the same key for the tab, so a double click or a reload
 * returns the booking that already exists instead of creating a second one. A changed
 * payload gets a new key, which is exactly what the PRICE_CHANGED flow needs.
 */
async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

function stableStringify(payload: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)))
  );
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function idempotencyKeyFor(
  scope: string,
  payload: Record<string, unknown>
): Promise<string> {
  const slot = `haven.idem.${scope}.${await sha256(stableStringify(payload))}`;
  try {
    const existing = sessionStorage.getItem(slot);
    if (existing) return existing;
    const key = newKey();
    sessionStorage.setItem(slot, key);
    return key;
  } catch {
    return newKey();
  }
}

/** One key per message; a manual retry reuses the key it already has. */
export function newMessageIdempotencyKey(): string {
  return newKey();
}

/** Unsent composer text survives a reload per conversation. */
export function draftKey(conversationId: number): string {
  return `haven.draft.${conversationId}`;
}

export function readDraft(conversationId: number): string {
  try {
    return sessionStorage.getItem(draftKey(conversationId)) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(conversationId: number, value: string): void {
  try {
    if (value.trim() === '') sessionStorage.removeItem(draftKey(conversationId));
    else sessionStorage.setItem(draftKey(conversationId), value);
  } catch {
    /* ignore */
  }
}

/** Last search prefill for the hero (not personal data). */
export function rememberSearch(params: Record<string, string | number | undefined>): void {
  try {
    localStorage.setItem('haven.lastSearch', JSON.stringify(params));
  } catch {
    /* ignore */
  }
}

export function recallSearch(): Record<string, string> {
  try {
    const raw = localStorage.getItem('haven.lastSearch');
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** `next` is only accepted when it is a single-slash relative path (architecture 15.4). */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  return value;
}