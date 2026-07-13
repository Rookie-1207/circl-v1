import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { LogIn, UserPlus, Lock, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

/** Map technical auth error messages to user-friendly ones. */
function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid email or password")) {
    return "Incorrect email or password. Please try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please check your inbox and confirm your email before signing in.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Your password must be at least 6 characters long.";
  }
  if (lower.includes("jwt expired") || lower.includes("session expired") || lower.includes("refresh token")) {
    return "Your session has expired. Please sign in again.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "Couldn't connect right now. Please check your connection and try again.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Something went wrong. Please try again.";
}

type AuthMode = "login" | "signup";

export default function Login() {
  const [location, setLocation] = useLocation();
  const initialMode = useMemo<AuthMode>(
    () => (location === "/signup" ? "signup" : "login"),
    [location],
  );
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isSupabaseConfigured, login, signup } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleModeChange = (nextMode: string) => {
    const typedMode = nextMode as AuthMode;
    setMode(typedMode);
    setLocation(typedMode === "signup" ? "/signup" : "/login");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const error =
      mode === "login"
        ? await login(email, password)
        : await signup(email, password, { name, university });
    setIsSubmitting(false);

    if (error) {
      toast({ title: friendlyAuthError(error.message), variant: "destructive" });
      return;
    }

    toast({
      title:
        mode === "login"
          ? "Welcome back."
          : "Account created. Check your email if confirmation is required.",
    });
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-none shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display text-2xl font-bold shadow-md">
            C
          </div>
          <CardTitle className="font-display text-2xl">Circl</CardTitle>
          <CardDescription>
            Sign in to find people on campus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Authentication is temporarily unavailable. Please try again later.
            </div>
          )}

          <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Signup</TabsTrigger>
            </TabsList>

            <TabsContent value={mode} className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your display name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="university">University</Label>
                      <Input
                        id="university"
                        autoComplete="organization"
                        required
                        value={university}
                        onChange={(event) => setUniversity(event.target.value)}
                        placeholder="Your university"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@university.edu"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isSupabaseConfigured || isSubmitting}
                >
                  {isSubmitting ? (
                    <Spinner />
                  ) : mode === "login" ? (
                    <LogIn className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {mode === "login" ? "Login" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-5 mt-4 px-2">
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="text-[11px]">Secure Auth</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-[11px]">Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[11px]">Privacy First</span>
          </div>
        </div>

        {/* Privacy notice */}
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60 mt-3 px-4">
          🔒 We never sell your personal information. Your data is securely encrypted and used only to provide the Circl experience.
        </p>
      </Card>
    </div>
  );
}
