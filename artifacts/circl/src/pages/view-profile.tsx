import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetUserProfile,
  getGetUserProfileQueryKey,
  getDiscoverUsersQueryKey,
  useCreateConnection,
  useBlockUser,
  useCreateReport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import {
  AlertCircle,
  MapPin,
  ArrowLeft,
  Check,
  Target,
  Clock,
  Search,
  MoreHorizontal,
  Ban,
  Flag,
  UserCheck,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const REPORT_REASONS = [
  "Spam or fake profile",
  "Harassment or bullying",
  "Inappropriate content",
  "Impersonation",
  "Hate speech",
  "Other",
];

export default function ViewProfile() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError, refetch } = useGetUserProfile(userId, {
    query: { enabled: !!userId, queryKey: getGetUserProfileQueryKey(userId) }
  });

  const createConnection = useCreateConnection();
  const blockUser = useBlockUser();
  const createReport = useCreateReport();
  const { toast } = useToast();

  // Connection request state — persists for this page visit
  const [connectionSent, setConnectionSent] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Block dialog
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  // Report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const handleConnect = () => {
    if (connectionSent || createConnection.isPending) return;
    setConnectionError(null);
    createConnection.mutate(
      { data: { toUserId: userId, action: "connect" } },
      {
        onSuccess: () => {
          setConnectionSent(true);
          toast({ title: "Connection request sent!" });
          // Invalidate discover so this person disappears from discovery
          queryClient.invalidateQueries({ queryKey: getDiscoverUsersQueryKey() });
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "Something went wrong. Please try again.";
          // 409 means already requested — treat as success
          if (msg.includes("409") || msg.toLowerCase().includes("already")) {
            setConnectionSent(true);
          } else {
            setConnectionError(msg);
            toast({ title: msg, variant: "destructive" });
          }
        },
      }
    );
  };

  const handleBlock = () => {
    blockUser.mutate({ id: userId }, {
      onSuccess: () => {
        toast({ title: `${user?.name ?? "User"} has been blocked.` });
        setBlockDialogOpen(false);
        // Invalidate discover so blocked user disappears
        queryClient.invalidateQueries({ queryKey: getDiscoverUsersQueryKey() });
        setLocation("/discover");
      },
      onError: () => {
        toast({ title: "Failed to block user. Please try again.", variant: "destructive" });
      },
    });
  };

  const handleReport = () => {
    if (!reportReason) {
      toast({ title: "Please select a reason for your report.", variant: "destructive" });
      return;
    }
    createReport.mutate(
      {
        data: {
          targetType: "user",
          targetId: userId,
          reason: reportReason,
          description: reportDescription.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Report submitted",
            description: "Thanks for keeping Circl safe. We'll review it shortly.",
          });
          setReportDialogOpen(false);
          setReportReason("");
          setReportDescription("");
        },
        onError: () => {
          toast({ title: "Failed to submit report. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-24 mb-6" />
        <div className="bg-card rounded-2xl border p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Couldn't load this profile</h2>
        <p className="text-muted-foreground mt-2">Try again in a moment.</p>
        <Button variant="outline" className="mt-6 rounded-full" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Profile not found</h2>
        <Link href="/discover">
          <Button variant="link" className="mt-4">Back to Discover</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/discover">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-2xl border shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-8">
        <div className="h-32 bg-gradient-to-r from-primary/30 via-accent/50 to-primary/10" />

        <div className="px-8 pb-8">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-end -mt-16 mb-6">
            <UserAvatar user={user} className="h-32 w-32 border-4 border-card shadow-lg bg-background text-4xl" showOnlineStatus />
            <div className="flex-1 pb-2">
              <h1 className="text-3xl font-display font-bold">{user.name}</h1>
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium mt-1">
                <MapPin className="h-4 w-4" />
                {user.university}
              </div>
            </div>
            <div className="pb-2 flex items-center gap-2 w-full sm:w-auto">
              {connectionSent ? (
                <Button
                  className="flex-1 sm:flex-none rounded-full px-8 shadow-md"
                  size="lg"
                  variant="secondary"
                  disabled
                >
                  <UserCheck className="mr-2 h-5 w-5" /> Requested
                </Button>
              ) : (
                <Button
                  className="flex-1 sm:flex-none rounded-full px-8 shadow-md hover-elevate"
                  size="lg"
                  onClick={handleConnect}
                  disabled={createConnection.isPending}
                >
                  {createConnection.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-5 w-5" />
                  )}
                  {createConnection.isPending ? "Sending…" : "Connect"}
                </Button>
              )}

              {/* More actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full shrink-0" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    onClick={() => setBlockDialogOpen(true)}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Block {user.name.split(" ")[0]}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setReportDialogOpen(true)}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report {user.name.split(" ")[0]}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-8">
            {user.bio && (
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">About</h3>
                <p className="text-lg leading-relaxed">{user.bio}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-8">
              {user.interests && user.interests.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" /> Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map(interest => (
                      <Badge key={interest} variant="secondary" className="px-3 py-1 font-medium bg-secondary/80 text-secondary-foreground">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {user.lookingFor && user.lookingFor.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4" /> Looking For
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.lookingFor.map(item => (
                      <Badge key={item} variant="outline" className="px-3 py-1 font-medium border-primary/30 bg-primary/5 text-primary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {user.availability && user.availability.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Availability
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.availability.map(item => (
                      <Badge key={item} variant="outline" className="px-3 py-1 font-medium">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {user.goals && (
                <div className="sm:col-span-2 bg-secondary/30 p-4 rounded-xl border border-secondary">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Current Goals</h3>
                  <p className="font-medium text-foreground/90">{user.goals}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Block confirmation dialog */}
      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to find your profile, send connection requests, or message you. You can unblock them any time from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={blockUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {blockUser.isPending ? "Blocking…" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {user.name}</DialogTitle>
            <DialogDescription>
              Your report is anonymous. Thanks for helping keep Circl safe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason <span className="text-destructive">*</span></Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-description">Additional details <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="report-description"
                placeholder="Describe what happened…"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleReport}
              disabled={createReport.isPending || !reportReason}
            >
              {createReport.isPending ? "Submitting…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
