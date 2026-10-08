import { useEffect } from 'react';
import { ENV } from '@/config/env';

/**
 * The app is a client-rendered SPA, so per-route metadata is applied imperatively
 * (the architecture document assumes Next.js server rendering; everything else about
 * Section 15.3 still holds — private routes are `noindex`).
 */
export function useDocumentTitle(title: string, description?: string): void {
  useEffect(() => {
    document.title = title ? `${title} | ${ENV.APP_NAME}` : ENV.APP_NAME;
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'description';
        document.head.appendChild(tag);
      }
      tag.content = description;
    }
    const privateArea = ['/trips', '/checkout', '/inbox', '/notifications', '/account', '/reviews', '/become-host', '/host', '/support', '/admin'];
    const path = window.location.pathname;
    const noindex =
      privateArea.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ||
      path.startsWith('/login') ||
      path.startsWith('/register');
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = noindex ? 'noindex,nofollow' : 'index,follow';
  }, [title, description]);
}

export function setCanonical(path: string): void {
  const url = `${ENV.SITE_URL.replace(/\/$/, '')}${path}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

/** JSON-LD for listing pages; keeps the page eligible for rich results. */
export function setJsonLd(data: Record<string, unknown> | null): void {
  const existing = document.getElementById('jsonld');
  document.getElementById('jsonld')?.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.id = 'jsonld';
  script.type = 'application/ld+json';
  script.text = JSON.stringify(data);
  document.head.appendChild(script);
}