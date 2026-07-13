import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, LogIn, UserPlus, Lock, Shield, ShieldCheck, CheckCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

/** Map technical Supabase error messages to user-friendly language. */
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
  if (lower.includes("supabase is not configured")) {
    return "Authentication is temporarily unavailable. Please try again later.";
  }
  return "Something went wrong. Please try again.";
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  barColor: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { score: 0, label: "", color: "", barColor: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "text-red-500", "text-amber-500", "text-blue-500", "text-green-500"];
  const bars = ["", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-green-500"];
  return { score: capped, label: labels[capped], color: colors[capped], barColor: bars[capped] };
}

export default function Login() {
  const [location, setLocation] = useLocation();
  const initialMode = useMemo<AuthMode>(
    () => (location === "/signup" ? "signup" : "login"),
    [location],
  );
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupUniversity, setSignupUniversity] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

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

  const passwordStrength = getPasswordStrength(signupPassword);
  const passwordsMatch = signupPassword === signupConfirm;

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const error = await login(email, password);
    setIsSubmitting(false);
    if (error) {
      toast({ title: friendlyAuthError(error.message), variant: "destructive" });
    }
  };

  const handleSignupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!passwordsMatch) {
      toast({ title: "Passwords do not match. Please try again.", variant: "destructive" });
      return;
    }
    if (signupPassword.length < 6) {
      toast({ title: "Your password must be at least 6 characters long.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const error = await signup(signupEmail, signupPassword, { name: signupName, university: signupUniversity });
    setIsSubmitting(false);
    if (error) {
      toast({ title: friendlyAuthError(error.message), variant: "destructive" });
      return;
    }
    toast({ title: "Account created! Check your email if confirmation is required." });
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-none shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display text-2xl font-bold shadow-md select-none">
            C
          </div>
          <CardTitle className="font-display text-2xl">Circl</CardTitle>
          <CardDescription>
            {mode === "login" ? "Welcome back. Sign in to continue." : "Create your account to get started."}
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
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            {/* ── Login ─────────────────────────────────────────── */}
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isSupabaseConfigured || isSubmitting}
                >
                  {isSubmitting ? <Spinner /> : <LogIn className="h-4 w-4" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            {/* ── Signup ────────────────────────────────────────── */}
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignupSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="signup-name"
                      autoComplete="name"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-university">
                      University <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="signup-university"
                      autoComplete="organization"
                      required
                      value={signupUniversity}
                      onChange={(e) => setSignupUniversity(e.target.value)}
                      placeholder="Your university"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">
                    Email address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowSignupPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Password strength bar */}
                  {signupPassword.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={n}
                            className={cn(
                              "flex-1 rounded-full transition-all duration-300",
                              passwordStrength.score >= n ? passwordStrength.barColor : "bg-secondary",
                            )}
                          />
                        ))}
                      </div>
                      {passwordStrength.label && (
                        <p className={cn("text-xs font-medium", passwordStrength.color)}>
                          {passwordStrength.label}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">
                    Confirm password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm"
                      type={showSignupConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={signupConfirm}
                      onChange={(e) => setSignupConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      className={cn(
                        "pr-10",
                        signupConfirm.length > 0 && !passwordsMatch &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    <button
                      type="button"
                      aria-label={showSignupConfirm ? "Hide password" : "Show password"}
                      onClick={() => setShowSignupConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showSignupConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {signupConfirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                  {signupConfirm.length > 0 && passwordsMatch && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isSupabaseConfigured || isSubmitting}
                >
                  {isSubmitting ? <Spinner /> : <UserPlus className="h-4 w-4" />}
                  Create account
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> Required fields
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-5 mt-2 px-2">
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
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60 mt-3 px-6 pb-4">
          🔒 We never sell your personal information. Your data is securely encrypted and used only to provide the Circl experience.
        </p>
      </Card>
    </div>
  );
}
