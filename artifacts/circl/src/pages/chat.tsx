import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetMessages, getGetMessagesQueryKey, useSendMessage, useGetUserProfile, getGetUserProfileQueryKey, useListConversations, useGetMyProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { AlertCircle, ArrowLeft, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const conversationId = Number(id);
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // We need the other user's profile. We can get it from the conversation list
  const { data: conversations } = useListConversations();
  const conversation = conversations?.find(c => c.id === conversationId);
  const otherUserId = conversation?.otherUser.id;
  const { data: currentUser } = useGetMyProfile();

  const { data: messages, isLoading, isError, refetch } = useGetMessages(conversationId, {
    query: { refetchInterval: 5000, queryKey: getGetMessagesQueryKey(conversationId) } // Poll every 5s
  });
  
  const { data: otherUser } = useGetUserProfile(otherUserId as number, {
    query: { enabled: !!otherUserId, queryKey: getGetUserProfileQueryKey(otherUserId as number) }
  });

  const sendMessage = useSendMessage();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sendMessage.isPending) return;

    sendMessage.mutate(
      { id: conversationId, data: { content: content.trim() } },
      {
        onSuccess: () => {
          setContent("");
          refetch();
        }
      }
    );
  };

  if (isLoading && !messages) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)]">
        <div className="flex items-center gap-4 p-4 border-b bg-card">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-2/3 rounded-2xl rounded-tl-sm" />
          <Skeleton className="h-12 w-1/2 rounded-2xl rounded-tr-sm ml-auto" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 p-4 border-b bg-card">
          <Link href="/conversations">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg">Could not load conversation</h2>
          <p className="text-muted-foreground text-sm mt-2">Try again in a moment.</p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-card/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Link href="/conversations">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          
          {otherUser ? (
            <Link href={`/profile/${otherUser.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <UserAvatar user={otherUser} className="h-10 w-10" showOnlineStatus />
              <div>
                <h2 className="font-display font-bold text-sm sm:text-base leading-tight">
                  {otherUser.name}
                </h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {otherUser.university}
                </p>
              </div>
            </Link>
          ) : (
            <Skeleton className="h-10 w-48" />
          )}
        </div>
        
        {otherUser && (
          <Link href={`/profile/${otherUser.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground">
              <Info className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20" ref={scrollRef}>
        {!messages || messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4">
              <Send className="h-6 w-6 opacity-50" />
            </div>
            <p>Say hi to {otherUser?.name.split(' ')[0] || "them"}!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser?.id;
            const showTime = idx === 0 || 
              (new Date(msg.createdAt).getTime() - new Date(messages[idx-1].createdAt).getTime() > 5 * 60000);
              
            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                {showTime && (
                  <span className="text-[10px] font-medium text-muted-foreground/70 mb-2 mt-2 px-2">
                    {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                  </span>
                )}
                <div 
                  className={cn(
                    "max-w-[75%] px-4 py-2 text-sm relative group animate-in fade-in slide-in-from-bottom-2",
                    isMe 
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" 
                      : "bg-card border shadow-sm text-foreground rounded-2xl rounded-tl-sm"
                  )}
                >
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-card border-t flex gap-2">
        <Input
          placeholder="Type a message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 rounded-full bg-secondary/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background"
          autoFocus
          autoComplete="off"
        />
        <Button 
          type="submit" 
          size="icon" 
          className="rounded-full shrink-0 h-10 w-10"
          disabled={!content.trim() || sendMessage.isPending}
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
