import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { TooltipProvider } from '@/components/ui';
import { router } from './router';
import '@/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // retry network failures and 5xx only; never 4xx (architecture 4.6)
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status ?? 0;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

/** Restores the top of the page on navigation, like every other web app. */
function ScrollToTop() {
  React.useEffect(() => {
    const unsubscribe = router.subscribe(() => window.scrollTo({ top: 0 }));
    return unsubscribe;
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
          <ScrollToTop />
          <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);