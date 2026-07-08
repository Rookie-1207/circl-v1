import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfile } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: UserProfile;
  className?: string;
  showOnlineStatus?: boolean;
}

export function UserAvatar({ user, className, showOnlineStatus }: UserAvatarProps) {
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div className="relative inline-block">
      <Avatar className={cn("border bg-muted", className)}>
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />}
        <AvatarFallback className="font-display font-medium text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      {showOnlineStatus && user.isOnline && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
      )}
    </div>
  );
}
