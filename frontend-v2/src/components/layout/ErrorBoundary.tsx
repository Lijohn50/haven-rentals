import React from 'react';
import { Button } from '@/components/ui';

interface ErrorBoundaryState {
  error: Error | null;
}

/** A crash in one route group never takes down the header (architecture 4.5 step 4). */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-narrow px-4 py-16">
        <h1 className="text-xl font-semibold text-ink">This page could not be displayed</h1>
        <p className="mt-2 text-sm text-muted">
          {this.props.label ? `${this.props.label} hit an unexpected error.` : 'Something went wrong.'}{' '}
          Reloading usually clears it.
        </p>
        {error.message && (
          <p className="mt-2 break-words text-xs text-muted">{error.message}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}