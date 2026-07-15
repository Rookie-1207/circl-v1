import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { getAuthRedirectUrl, isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  /** True when the session expired without an explicit logout (not when the user clicked Log out). */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  session: Session | null;
  user: User | null;
  login: (email: string, password: string) => Promise<AuthError | null>;
  signup: (
    email: string,
    password: string,
    metadata: { name: string; university: string },
  ) => Promise<AuthError | null>;
  logout: () => Promise<AuthError | null>;
  resetPassword: (email: string, redirectTo?: string) => Promise<AuthError | null>;
  updatePassword: (newPassword: string) => Promise<AuthError | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const isIntentionalLogout = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setIsLoading(false);

      if (!nextSession && event === "SIGNED_OUT") {
        queryClient.clear();
        // If the logout was NOT triggered intentionally (user clicked "Log out"),
        // mark the session as expired so the AuthGate can show a friendly message.
        if (!isIntentionalLogout.current) {
          setSessionExpired(true);
        }
        isIntentionalLogout.current = false;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(session),
      isLoading,
      isSupabaseConfigured,
      sessionExpired,
      clearSessionExpired: () => setSessionExpired(false),
      session,
      user: session?.user ?? null,
      async login(email, password) {
        if (!supabase) {
          return {
            name: "AuthConfigError",
            message: "Supabase is not configured.",
          } as AuthError;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return error;
      },
      async signup(email, password, metadata) {
        if (!supabase) {
          return {
            name: "AuthConfigError",
            message: "Supabase is not configured.",
          } as AuthError;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            // Dynamic per-environment link: localhost in dev, real domain in prod.
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        return error;
      },
      async logout() {
        if (!supabase) return null;

        isIntentionalLogout.current = true;
        const { error } = await supabase.auth.signOut();
        if (!error) {
          setSession(null);
          queryClient.clear();
        } else {
          // Reset the flag if signOut failed
          isIntentionalLogout.current = false;
        }
        return error;
      },
      async resetPassword(email, redirectTo) {
        if (!supabase) {
          return { name: "AuthConfigError", message: "Supabase is not configured." } as AuthError;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo ?? getAuthRedirectUrl("reset-password"),
        });
        return error;
      },
      async updatePassword(newPassword) {
        if (!supabase) {
          return { name: "AuthConfigError", message: "Supabase is not configured." } as AuthError;
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return error;
      },
    }),
    [isLoading, queryClient, session, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
