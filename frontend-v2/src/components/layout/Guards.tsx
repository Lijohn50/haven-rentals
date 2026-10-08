import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { ROUTES, isPrivatePath } from '@/config/routes';
import { safeNext } from '@/lib/idempotency';
import { Spinner } from '@/components/ui';
import type { Role } from '@/types/api';

/** Guards are UX only; the API enforces roles and ownership (architecture D8, 7.6). */
export const RequireAuth: React.FC<{ roles?: Role[] }> = ({ roles }) => {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status !== 'authenticated') {
    const next = safeNext(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`} replace />;
  }

  if (roles && roles.length > 0 && !roles.some((role) => user?.roles.includes(role))) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return <Outlet />;
};

export const RequireGuest: React.FC = () => {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'authenticated') {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={safeNext(next)} replace />;
  }
  return <Outlet />;
};

/** Anything that must never be indexed also gets `noindex` from the metadata hook. */
export function useNoIndex(): boolean {
  return isPrivatePath(window.location.pathname);
}