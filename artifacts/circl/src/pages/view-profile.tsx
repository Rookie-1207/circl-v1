import { useParams, Link } from "wouter";
import { useGetUserProfile, getGetUserProfileQueryKey, useCreateConnection } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { MapPin, ArrowLeft, Check, Target, Clock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ViewProfile() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  
  const { data: user, isLoading } = useGetUserProfile(userId, {
    query: { enabled: !!userId, queryKey: getGetUserProfileQueryKey(userId) }
  });
  
  const createConnection = useCreateConnection();
  const { toast } = useToast();

  const handleConnect = () => {
    createConnection.mutate(
      { data: { toUserId: userId, action: "connect" } },
      {
        onSuccess: () => {
          toast({ title: "Connection request sent!" });
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

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">User not found</h2>
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
            <div className="pb-2 w-full sm:w-auto">
              <Button 
                className="w-full sm:w-auto rounded-full px-8 shadow-md hover-elevate" 
                size="lg"
                onClick={handleConnect}
                disabled={createConnection.isPending}
              >
                <Check className="mr-2 h-5 w-5" /> Connect
              </Button>
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
    </div>
  );
}
