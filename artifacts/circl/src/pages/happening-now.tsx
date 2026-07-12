import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MapPin,
  Clock,
  Users,
  Flame,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityStatus = 'open' | 'full' | 'cancelled' | 'completed';
type ParticipantStatus = 'pending' | 'accepted' | 'rejected' | null;

interface ActivityHost {
  id: number;
  name: string;
  avatarUrl?: string | null;
}

interface Activity {
  id: number;
  category: string;
  title: string;
  location: string;
  scheduledAt: string;
  maxParticipants: number;
  participantCount: number;
  description?: string | null;
  visibility: string;
  status: ActivityStatus;
  isIndoor?: boolean | null;
  host: ActivityHost;
  distanceKm?: number | null;
  userParticipantStatus: ParticipantStatus;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'gym', label: 'Gym', emoji: '🏋️' },
  { id: 'study', label: 'Study', emoji: '📚' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'sports', label: 'Sports', emoji: '🏏' },
  { id: 'build', label: 'Build', emoji: '💻' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'badminton', label: 'Badminton', emoji: '🏸' },
  { id: 'running', label: 'Running', emoji: '🏃' },
] as const;

const DATE_FILTERS = [
  { id: 'all', label: 'Anytime' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'This Week' },
] as const;

function getCategoryEmoji(categoryId: string) {
  return CATEGORIES.find((c) => c.id === categoryId)?.emoji ?? '📌';
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function getBasePath() {
  return (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
}

async function apiFetch(path: string, options?: RequestInit) {
  const { supabase } = await import('@/lib/supabase');
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const token = session?.access_token;

  const res = await fetch(`${getBasePath()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useActivities(category: string, dateFilter: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Attempt geolocation once
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silently ignore if denied
        { timeout: 5000 },
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (dateFilter !== 'all') params.set('date', dateFilter);
    if (userCoords) {
      params.set('lat', String(userCoords.lat));
      params.set('lng', String(userCoords.lng));
    }

    apiFetch(`/api/activities?${params}`)
      .then((data) => {
        if (!cancelled) {
          setActivities(data as Activity[]);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category, dateFilter, userCoords]);

  const refetch = () => {
    setActivities([]);
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (dateFilter !== 'all') params.set('date', dateFilter);
    if (userCoords) {
      params.set('lat', String(userCoords.lat));
      params.set('lng', String(userCoords.lng));
    }

    apiFetch(`/api/activities?${params}`)
      .then((data) => {
        setActivities(data as Activity[]);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  };

  return { activities, isLoading, error, refetch };
}

// ─── Components ───────────────────────────────────────────────────────────────

function CategoryPill({
  cat,
  active,
  onClick,
}: {
  cat: (typeof CATEGORIES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
      )}
    >
      <span>{cat.emoji}</span>
      <span>{cat.label}</span>
    </button>
  );
}

function ActivityCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
    </div>
  );
}

function formatScheduled(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

function JoinButton({
  activity,
  onJoin,
}: {
  activity: Activity;
  onJoin: (id: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const status = activity.userParticipantStatus;
  const isFull = activity.participantCount >= activity.maxParticipants;

  if (status === 'accepted') {
    return (
      <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 px-3 py-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Joined
      </Badge>
    );
  }

  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 text-muted-foreground px-3 py-1.5"
      >
        <Loader2 className="h-3.5 w-3.5" />
        Pending
      </Badge>
    );
  }

  return (
    <Button
      size="sm"
      className="rounded-xl h-9 px-5 font-semibold"
      disabled={isFull || loading}
      onClick={async () => {
        setLoading(true);
        await onJoin(activity.id);
        setLoading(false);
      }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isFull ? 'Full' : 'Join'}
    </Button>
  );
}

function ActivityCard({
  activity,
  onJoin,
  index,
}: {
  activity: Activity;
  onJoin: (id: number) => Promise<void>;
  index: number;
}) {
  const spotsLeft = activity.maxParticipants - activity.participantCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="group rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="text-base">{getCategoryEmoji(activity.category)}</span>
          <span className="capitalize">{activity.category}</span>
        </span>
        {activity.distanceKm !== null && activity.distanceKm !== undefined && (
          <span className="text-xs font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
            {activity.distanceKm < 1
              ? `${Math.round(activity.distanceKm * 1000)} m`
              : `${activity.distanceKm} km`}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground mb-3 leading-snug">
        {activity.title}
      </h3>

      {/* Meta */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {formatScheduled(activity.scheduledAt)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {activity.location}
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {activity.participantCount}/{activity.maxParticipants}
            </span>
          </div>
          {spotsLeft > 0 && spotsLeft <= 2 && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left
            </span>
          )}
          <span className="text-xs text-muted-foreground/70">
            by {activity.host.name.split(' ')[0]}
          </span>
        </div>
        <JoinButton activity={activity} onJoin={onJoin} />
      </div>
    </motion.div>
  );
}

function EmptyState({ category }: { category: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="text-5xl mb-4">
        {category === 'all' ? '🌅' : getCategoryEmoji(category)}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Nothing happening yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {category === 'all'
          ? 'Be the first to create an activity and invite others to join you.'
          : `No ${category} activities right now. Start one!`}
      </p>
    </motion.div>
  );
}

// ─── Create Activity Sheet ────────────────────────────────────────────────────

interface CreateForm {
  category: string;
  title: string;
  location: string;
  scheduledAt: string;
  maxParticipants: string;
  description: string;
  isIndoor: string;
}

const EMPTY_FORM: CreateForm = {
  category: '',
  title: '',
  location: '',
  scheduledAt: '',
  maxParticipants: '4',
  description: '',
  isIndoor: '',
};

function localDateTimeDefault() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function CreateActivitySheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateForm>({
    ...EMPTY_FORM,
    scheduledAt: localDateTimeDefault(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  function set(key: keyof CreateForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          title: form.title.trim(),
          location: form.location.trim(),
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          maxParticipants: parseInt(form.maxParticipants),
          description: form.description.trim() || undefined,
          isIndoor:
            form.isIndoor === 'indoor'
              ? true
              : form.isIndoor === 'outdoor'
                ? false
                : undefined,
        }),
      });

      toast({ title: 'Activity created!' });
      onOpenChange(false);
      setForm({ ...EMPTY_FORM, scheduledAt: localDateTimeDefault() });
      onCreated();
    } catch (err) {
      toast({
        title: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pt-6 pb-safe max-h-[92dvh] overflow-y-auto">
        <SheetHeader className="mb-6 text-left">
          <SheetTitle className="text-xl font-semibold">New Activity</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Activity type</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)} required>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="act-title">Title</Label>
            <Input
              id="act-title"
              className="rounded-xl"
              placeholder="e.g. Morning run at the park"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="act-location">Location</Label>
            <Input
              id="act-location"
              className="rounded-xl"
              placeholder="e.g. Gold's Gym, Main Street"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              required
            />
          </div>

          {/* Date/Time */}
          <div className="space-y-1.5">
            <Label htmlFor="act-time">When</Label>
            <Input
              id="act-time"
              type="datetime-local"
              className="rounded-xl"
              value={form.scheduledAt}
              onChange={(e) => set('scheduledAt', e.target.value)}
              required
            />
          </div>

          {/* Max participants + Indoor/Outdoor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Spots needed</Label>
              <Select
                value={form.maxParticipants}
                onValueChange={(v) => set('maxParticipants', v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} people
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Venue type</Label>
              <Select
                value={form.isIndoor}
                onValueChange={(v) => set('isIndoor', v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="act-desc">
              Description{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="act-desc"
              className="rounded-xl resize-none"
              rows={3}
              placeholder="Any details others should know…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={500}
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl h-12 font-semibold text-base"
            disabled={isSubmitting || !form.category || !form.title || !form.location}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Create Activity'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HappeningNow() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDate, setSelectedDate] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { activities, isLoading, error, refetch } = useActivities(
    selectedCategory,
    selectedDate,
  );

  async function handleJoin(id: number) {
    try {
      const result = await apiFetch(`/api/activities/${id}/join`, { method: 'POST' });
      if (result.status === 'pending') {
        toast({ title: 'Request sent! Waiting for the host to accept.' });
      } else {
        toast({ title: "You're in!" });
      }
      refetch();
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold tracking-tight">Happening Now</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Discover activities around you
        </p>
      </div>

      {/* Category scroll */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat.id}
            cat={cat}
            active={selectedCategory === cat.id}
            onClick={() => setSelectedCategory(cat.id)}
          />
        ))}
      </div>

      {/* Date filter */}
      <div className="flex gap-2 flex-wrap">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedDate(f.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all duration-200',
              selectedDate === f.id
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            <Calendar className="h-3 w-3" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={refetch}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <EmptyState category={selectedCategory} />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {activities.map((activity, i) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onJoin={handleJoin}
                index={i}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background shadow-xl md:bottom-8 md:right-8"
        aria-label="Create activity"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <CreateActivitySheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetch}
      />
    </div>
  );
}
