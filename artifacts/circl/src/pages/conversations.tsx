import { useListConversations } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { Link } from "wouter";
import { AlertCircle, MessageSquare, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Conversations() {
  const { data: conversations, isLoading, isError, refetch } = useListConversations();

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Keep the conversation going.
        </p>
      </div>

      <div className="flex-1 bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-bold">Could not load messages</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Try again in a moment.
            </p>
            <Button className="mt-6 rounded-full" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="divide-y overflow-y-auto">
            {conversations.map((conv) => (
              <Link key={conv.id} href={`/conversations/${conv.id}`}>
                <div className="p-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="relative shrink-0">
                    <UserAvatar user={conv.otherUser} className="h-14 w-14" showOnlineStatus />
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold border-2 border-card">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-display font-bold truncate pr-2">
                        {conv.otherUser.name}
                      </h3>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                        {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {conv.lastMessage || "Start a conversation!"}
                    </p>
                  </div>
                  
                  <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-bold">No messages yet</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              When you match with someone, you can start chatting here.
            </p>
            <Link href="/matches">
              <Button className="mt-6 rounded-full" variant="outline">View Matches</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
