import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary text-4xl font-display font-bold text-muted-foreground select-none">
          ?
        </div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link href="/dashboard">
          <Button className="rounded-full px-8">Go home</Button>
        </Link>
      </div>
    </div>
  );
}
