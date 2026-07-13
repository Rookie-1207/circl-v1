import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth-provider";

const authRoutes = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="h-5 w-5" />
        Checking your session...
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const isAuthRoute = authRoutes.has(location);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isAuthRoute) {
      setLocation("/login", { replace: true });
      return;
    }

    if (isAuthenticated && isAuthRoute) {
      setLocation("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isAuthRoute, isLoading, setLocation]);

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated && !isAuthRoute) return null;
  if (isAuthenticated && isAuthRoute) return null;

  return <>{children}</>;
}
