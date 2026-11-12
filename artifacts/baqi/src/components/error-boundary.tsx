import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  const ar = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background p-6" dir={ar ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-card">
        <h1 className="text-xl font-semibold text-foreground">{ar ? 'حدث خطأ ما' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ar ? 'واجه هذا الجزء من باقي خطأً. بقية التطبيق ما زالت تعمل.' : 'This part of Baqi hit an error. The rest of the app is still running.'}
        </p>
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-start text-xs text-foreground" dir="ltr">
            {error.message || String(error)}
          </pre>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={resetError} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[#064c44]">
            {ar ? 'أعد المحاولة' : 'Try again'}
          </button>
          <a href={import.meta.env.BASE_URL} className="inline-flex min-h-11 items-center rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground no-underline hover:bg-muted">
            {ar ? 'الصفحة الرئيسية' : 'Home'}
          </a>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
