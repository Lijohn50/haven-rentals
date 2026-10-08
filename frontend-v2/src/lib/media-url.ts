import { ENV } from '@/config/env';

/** Media URLs come back relative (`/api/v1/media/listings/12/file.jpg`); prefix if needed. */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!ENV.API_ORIGIN) return url;
  return `${ENV.API_ORIGIN.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#E2E8F0"/><path d="M120 210v-70l80-46 80 46v70h-40v-52h-80v52z" fill="#94A3B8"/><circle cx="200" cy="140" r="16" fill="#F8FAFC"/></svg>`
  );