import { useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bell, Check, MessageCircle, UserPlus, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

export default function Notifications() {
  const { data: notifications, isLoading, isError, refetch } = useListNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleNotificationClick = (id: number, isRead: boolean) => {
    if (!isRead) {
      markRead.mutate({ id }, {
        onSuccess: () => refetch()
      });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'connection_request': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'connection_accepted': return <Check className="h-4 w-4 text-green-500" />;
      case 'message': return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'match': return <Flame className="h-4 w-4 text-orange-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'connection_request': return 'bg-blue-500/10';
      case 'connection_accepted': return 'bg-green-500/10';
      case 'message': return 'bg-primary/10';
      case 'match': return 'bg-orange-500/10';
      default: return 'bg-secondary';
    }
  };

  const getLink = (type: string, actorId?: number | null) => {
    if (type === 'message') return '/conversations';
    if (type === 'connection_request' || type === 'match') return '/matches';
    if (actorId) return `/profile/${actorId}`;
    return '#';
  };

  const hasUnread = notifications?.some(n => !n.isRead);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Stay updated with your campus network.
          </p>
        </div>
        {hasUnread && (
          <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={markAllRead.isPending} className="rounded-full">
            <Check className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-bold">Could not load alerts</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Try again in a moment.
            </p>
            <Button variant="outline" className="mt-6 rounded-full" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="divide-y">
            {notifications.map((notif) => {
              const link = getLink(notif.type, notif.actorId);
              
              return (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-4 flex gap-4 transition-colors hover:bg-secondary/50",
                    !notif.isRead ? "bg-primary/5" : ""
                  )}
                  onClick={() => handleNotificationClick(notif.id, notif.isRead)}
                >
                  <Link href={link} className="shrink-0 pt-1">
                    {notif.actor ? (
                      <div className="relative">
                        <UserAvatar user={notif.actor} className="h-10 w-10" />
                        <div className={cn("absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card flex items-center justify-center", getBgColor(notif.type))}>
                          {getIcon(notif.type)}
                        </div>
                      </div>
                    ) : (
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", getBgColor(notif.type))}>
                        {getIcon(notif.type)}
                      </div>
                    )}
                  </Link>
                  
                  <div className="flex-1 min-w-0">
                    <Link href={link}>
                      <p className={cn("text-sm", !notif.isRead && "font-medium text-foreground")}>
                        {notif.message}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  
                  {!notif.isRead && (
                    <div className="shrink-0 flex items-center justify-center pt-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-bold">All caught up</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              You don't have any notifications right now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
