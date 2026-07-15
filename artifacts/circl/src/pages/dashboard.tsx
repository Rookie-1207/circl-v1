import { useGetDashboardStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Users, UserPlus, MessageCircle, Eye } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading, isError, refetch } = useGetDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border shadow-sm">
          <AlertCircle className="h-10 w-10 mb-4 text-muted-foreground" />
          <h2 className="text-xl font-display font-bold">Couldn't load your dashboard</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Try again in a moment.
          </p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here's what's happening on campus today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Matches
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats.totalMatches}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats.pendingRequests}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              New Messages
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <MessageCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats.newMessages}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profile Views
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Eye className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats.profileViews}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-display">Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentMatches.length > 0 ? (
              <div className="flex flex-wrap gap-4">
                {stats.recentMatches.map((user) => (
                  <Link key={user.id} href={`/profile/${user.id}`}>
                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                      <UserAvatar
                        user={user}
                        className="h-16 w-16 group-hover:ring-2 ring-primary transition-all ring-offset-2 ring-offset-background"
                        showOnlineStatus
                      />
                      <span className="text-xs font-medium">{user.name.split(" ")[0]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-20" />
                <p className="font-medium text-sm">No matches yet</p>
                <Link href="/discover" className="text-primary hover:underline mt-2 text-sm font-medium">
                  Start discovering people →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-display">Activity by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.activityByCategory.length > 0 ? (
              <div className="space-y-4">
                {stats.activityByCategory.map((activity, i) => {
                  const maxCount = Math.max(...stats.activityByCategory.map((a) => a.count));
                  const percentage = Math.round((activity.count / maxCount) * 100);

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium truncate capitalize">
                        {activity.category}
                      </div>
                      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-8 text-right text-xs text-muted-foreground font-mono">
                        {activity.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <p className="font-medium text-sm">Nothing posted yet</p>
                <Link
                  href="/happening-now"
                  className="text-primary hover:underline mt-2 text-sm font-medium"
                >
                  Be the first to create an activity →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
