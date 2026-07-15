import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

const authRoutes = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

const REDIRECT_KEY = "circl_redirect_after_login";

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
  const { isAuthenticated, isLoading, sessionExpired, clearSessionExpired } = useAuth();
  const isAuthRoute = authRoutes.has(location);
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isAuthRoute) {
      // Preserve the intended destination so we can redirect back after login
      if (location !== "/" && location !== "/dashboard") {
        sessionStorage.setItem(REDIRECT_KEY, location);
      }

      if (sessionExpired) {
        clearSessionExpired();
        toast({
          title: "Your session has expired",
          description: "Please sign in again to continue.",
        });
      }

      setLocation("/login", { replace: true });
      return;
    }

    if (isAuthenticated && isAuthRoute) {
      // After login, redirect to intended destination if stored
      const pending = sessionStorage.getItem(REDIRECT_KEY);
      if (pending) {
        sessionStorage.removeItem(REDIRECT_KEY);
        setLocation(pending, { replace: true });
      } else {
        setLocation("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, isAuthRoute, isLoading, location, sessionExpired, clearSessionExpired, setLocation, toast]);

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated && !isAuthRoute) return null;
  if (isAuthenticated && isAuthRoute) return null;

  return <>{children}</>;
}
