import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Eye, EyeOff, KeyRound, Lock, Shield, ShieldCheck } from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type Stage = "loading" | "form" | "success" | "expired";

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

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updatePassword } = useAuth();

  useEffect(() => {
    if (!supabase) { setStage("expired"); return; }

    // detectSessionInUrl:true means Supabase auto-handles the recovery hash.
    // We listen for the PASSWORD_RECOVERY event to know the token is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStage("form");
      }
    });

    // Also check if there's already a recovery session active
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStage("form");
      } else {
        // Give the onAuthStateChange a moment to fire, then fall back to expired
        setTimeout(() => {
          setStage((s) => (s === "loading" ? "expired" : s));
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password === confirm;
  const canSubmit = password.length >= 6 && passwordsMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!passwordsMatch) { setError("Passwords do not match."); return; }

    setError(null);
    setIsSubmitting(true);
    const err = await updatePassword(password);
    setIsSubmitting(false);

    if (err) {
      const lower = err.message.toLowerCase();
      if (lower.includes("same password")) {
        setError("Please choose a different password from your current one.");
      } else if (lower.includes("network") || lower.includes("fetch")) {
        setError("Couldn't connect. Please try again.");
      } else {
        setError("Something went wrong. Please try again or request a new reset link.");
      }
      return;
    }

    setStage("success");
    // Sign out so the user is forced to log in fresh with the new password
    if (supabase) await supabase.auth.signOut();
    setTimeout(() => setLocation("/login"), 3000);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-none shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display text-2xl font-bold shadow-md">
            C
          </div>
          <CardTitle className="font-display text-2xl">
            {stage === "loading" && "Verifying link…"}
            {stage === "form" && "Choose a new password"}
            {stage === "success" && "Password updated"}
            {stage === "expired" && "Link expired"}
          </CardTitle>
          <CardDescription>
            {stage === "loading" && "Just a moment…"}
            {stage === "form" && "Pick a strong password you haven't used before."}
            {stage === "success" && "You'll be signed in automatically in a moment."}
            {stage === "expired" && "This reset link is no longer valid. Please request a new one."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {stage === "loading" && (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {stage === "expired" && (
            <div className="space-y-4 text-center">
              <div className="rounded-xl bg-secondary/50 p-5">
                <p className="text-sm text-muted-foreground">
                  Reset links expire after 10 minutes for your security.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => setLocation("/forgot-password")}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Request a new link
              </Button>
            </div>
          )}

          {stage === "success" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your password has been updated. Redirecting you to sign in…
              </p>
              <Spinner className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {stage === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1 h-1">
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          className={cn(
                            "flex-1 rounded-full transition-all duration-300",
                            strength.score >= n ? strength.barColor : "bg-secondary",
                          )}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <p className={cn("text-xs font-medium", strength.color)}>
                        {strength.label}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className={cn(
                      "pr-10",
                      confirm.length > 0 && !passwordsMatch && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
                {confirm.length > 0 && passwordsMatch && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {isSubmitting ? <Spinner /> : <KeyRound className="h-4 w-4" />}
                Update password
              </Button>
            </form>
          )}
        </CardContent>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-5 mt-4 px-2 pb-2">
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
      </Card>
    </div>
  );
}
