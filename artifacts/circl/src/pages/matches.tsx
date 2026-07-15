import {
  useListConnections,
  useUpdateConnection,
  useListConversations,
  getListConnectionsQueryKey,
  getListConversationsQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { AlertCircle, MessageCircle, Check, X, MapPin, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useGetMyProfile } from "@workspace/api-client-react";

export default function Matches() {
  const [, setLocation] = useLocation();
  const { data: profile } = useGetMyProfile();
  const {
    data: pendingConnections,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useListConnections({ status: "pending" });
  const {
    data: acceptedConnections,
    isLoading: acceptedLoading,
    isError: acceptedError,
    refetch: refetchAccepted,
  } = useListConnections({ status: "accepted" });
  const { data: conversations } = useListConversations();
  const updateConnection = useUpdateConnection();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const incomingPendingConnections =
    pendingConnections?.filter((conn) => conn.toUserId === profile?.id) ?? [];

  // Build a map from userId → conversationId for direct-chat navigation
  const conversationByUserId = new Map<number, number>();
  for (const conv of conversations ?? []) {
    conversationByUserId.set(conv.otherUser.id, conv.id);
  }

  const handleUpdate = (id: number, status: "accepted" | "rejected") => {
    updateConnection.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: status === "accepted" ? "Connection accepted!" : "Request declined.",
          });
          // Invalidate all affected queries
          queryClient.invalidateQueries({ queryKey: getListConnectionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        },
        onError: () => {
          toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const isLoading = pendingLoading || acceptedLoading;
  const isError = pendingError || acceptedError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Your Network</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your connections and pending requests.
        </p>
      </div>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="matches">My Matches</TabsTrigger>
          <TabsTrigger value="pending">
            Requests
            {incomingPendingConnections.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                {incomingPendingConnections.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-display font-bold">Couldn't load matches</h2>
              <p className="text-muted-foreground mt-2 max-w-sm">Try again in a moment.</p>
              <Button className="mt-6 rounded-full" variant="outline" onClick={() => refetchAccepted()}>
                Retry
              </Button>
            </div>
          ) : acceptedConnections && acceptedConnections.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {acceptedConnections.map((conn) => {
                // Show the other person, not the current user
                const user =
                  conn.toUserId === profile?.id ? conn.fromUser : conn.toUser;
                if (!user) return null;

                const convId = conversationByUserId.get(user.id);

                return (
                  <Card key={conn.id} className="border-none shadow-sm hover-elevate transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                      <Link href={`/profile/${user.id}`}>
                        <UserAvatar user={user} className="h-14 w-14 cursor-pointer" showOnlineStatus />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${user.id}`}>
                          <h3 className="font-display font-bold truncate hover:text-primary cursor-pointer">
                            {user.name}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{user.university}</span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full shrink-0"
                        aria-label={`Message ${user.name}`}
                        onClick={() =>
                          convId
                            ? setLocation(`/conversations/${convId}`)
                            : setLocation("/conversations")
                        }
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-display font-bold">No matches yet</h2>
              <p className="text-muted-foreground mt-2 max-w-sm">
                Head over to Discover to find people with similar interests.
              </p>
              <Link href="/discover">
                <Button className="mt-6 rounded-full">Go to Discover</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <AlertCircle className="h-10 w-10 mb-4 opacity-20" />
              <p>Couldn't load pending requests.</p>
              <Button className="mt-6 rounded-full" variant="outline" onClick={() => refetchPending()}>
                Retry
              </Button>
            </div>
          ) : incomingPendingConnections.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {incomingPendingConnections.map((conn) => {
                const user = conn.fromUser;
                if (!user) return null;

                return (
                  <Card key={conn.id} className="border-none shadow-sm animate-in fade-in zoom-in-95">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Link href={`/profile/${user.id}`}>
                          <UserAvatar user={user} className="h-14 w-14 cursor-pointer" />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/profile/${user.id}`}>
                            <h3 className="font-display font-bold truncate hover:text-primary cursor-pointer">
                              {user.name}
                            </h3>
                          </Link>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{user.university}</span>
                          </div>
                          <p className="text-xs mt-2 text-muted-foreground">
                            Wants to connect with you
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-lg"
                          onClick={() => handleUpdate(conn.id, "rejected")}
                          disabled={updateConnection.isPending}
                        >
                          <X className="h-4 w-4 mr-2" /> Decline
                        </Button>
                        <Button
                          className="flex-1 rounded-lg"
                          onClick={() => handleUpdate(conn.id, "accepted")}
                          disabled={updateConnection.isPending}
                        >
                          <Check className="h-4 w-4 mr-2" /> Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Check className="h-10 w-10 mb-4 opacity-20" />
              <p className="font-medium">All caught up</p>
              <p className="text-sm mt-1">No pending requests right now.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
