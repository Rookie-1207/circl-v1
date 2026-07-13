import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Lock, Mail, Shield, ShieldCheck } from "lucide-react";
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
import { useAuth } from "@/components/auth-provider";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const { resetPassword } = useAuth();

  const startCooldown = () => {
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || cooldown > 0) return;

    setError(null);
    setIsSubmitting(true);

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`.replace(/\/+/g, "/").replace(":/", "://");
    const err = await resetPassword(email, redirectTo);
    setIsSubmitting(false);

    if (err) {
      const lower = err.message.toLowerCase();
      if (lower.includes("rate limit") || lower.includes("too many")) {
        setError("Too many attempts. Please wait a moment before trying again.");
      } else if (lower.includes("network") || lower.includes("fetch")) {
        setError("Couldn't connect. Please check your connection and try again.");
      } else {
        // Always show the same message to prevent email enumeration
        setSubmitted(true);
        startCooldown();
      }
      return;
    }

    setSubmitted(true);
    startCooldown();
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-none shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display text-2xl font-bold shadow-md">
            C
          </div>
          <CardTitle className="font-display text-2xl">
            {submitted ? "Check your inbox" : "Reset your password"}
          </CardTitle>
          <CardDescription>
            {submitted
              ? `We sent a reset link to ${email}. It expires in 10 minutes.`
              : "Enter your email and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Didn't receive it? Check your spam folder, or{" "}
                  <button
                    type="button"
                    disabled={cooldown > 0}
                    onClick={() => { setSubmitted(false); }}
                    className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    try again{cooldown > 0 ? ` in ${cooldown}s` : ""}
                  </button>
                  .
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || cooldown > 0}
              >
                {isSubmitting ? <Spinner /> : <Mail className="h-4 w-4" />}
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Send reset link"}
              </Button>

              <Link href="/login">
                <Button variant="ghost" className="w-full text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to sign in
                </Button>
              </Link>
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
