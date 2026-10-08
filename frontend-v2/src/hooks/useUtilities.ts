import { useEffect, useRef, useState } from 'react';
import { serverNow } from '@/api/client';

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export interface Countdown {
  /** mm:ss, or 00:00 once expired */
  label: string;
  totalMs: number;
  expired: boolean;
  /** under three minutes, or under six hours for request deadlines */
  urgent: boolean;
}

/** Counts against the server clock, not the browser clock (document C4). */
export function useCountdown(target: string | null | undefined, urgentMs = 180_000): Countdown {
  const compute = (): Countdown => {
    if (!target) return { label: '', totalMs: 0, expired: true, urgent: false };
    const remaining = new Date(target).getTime() - serverNow();
    if (Number.isNaN(remaining) || remaining <= 0) {
      return { label: '00:00', totalMs: 0, expired: true, urgent: false };
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
      label: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      totalMs: remaining,
      expired: false,
      urgent: remaining <= urgentMs,
    };
  };

  const [countdown, setCountdown] = useState<Countdown>(compute);

  useEffect(() => {
    setCountdown(compute());
    if (!target) return undefined;
    const timer = window.setInterval(() => setCountdown(compute()), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return countdown;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  );
  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  return visible;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', handler);
    return () => list.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Fires `handler` when the browser goes offline, for the offline banner. */
export function useOnlineStatus(onOffline: () => void): boolean {
  const online = useRef(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [state, setState] = useState(online.current);
  useEffect(() => {
    const goOffline = () => {
      setState(false);
      onOffline();
    };
    const goOnline = () => setState(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [onOffline]);
  return state;
}