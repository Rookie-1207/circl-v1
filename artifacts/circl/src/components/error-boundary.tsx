import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in development; in production a real error reporter (Sentry etc.) would capture this
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary text-3xl select-none">
              ⚠️
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              An unexpected error occurred. Try refreshing the page — your data is safe.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="rounded-full" onClick={this.reset}>
                Try again
              </Button>
              <Button className="rounded-full px-6" onClick={() => window.location.href = "/dashboard"}>
                Go home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
