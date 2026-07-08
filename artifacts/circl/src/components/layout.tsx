import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Search,
  Users,
  MessageCircle,
  Bell,
  User,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useListNotifications, useListConversations } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: notifications } = useListNotifications();
  const { data: conversations } = useListConversations();

  const unreadNotifications =
    notifications?.filter((n) => !n.isRead).length || 0;
  const unreadMessages =
    conversations?.reduce((acc, curr) => acc + curr.unreadCount, 0) || 0;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Search, label: "Discover", href: "/discover" },
    { icon: Users, label: "Matches", href: "/matches" },
    {
      icon: MessageCircle,
      label: "Chats",
      href: "/conversations",
      badge: unreadMessages > 0 ? unreadMessages : null,
    },
    {
      icon: Bell,
      label: "Alerts",
      href: "/notifications",
      badge: unreadNotifications > 0 ? unreadNotifications : null,
    },
    { icon: User, label: "Profile", href: "/profile" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card px-4 py-6 sticky top-0 h-screen">
        <div className="mb-8 flex items-center px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display font-bold text-xl shadow-md">
            C
          </div>
          <span className="ml-3 font-display text-2xl font-bold tracking-tight">
            Circl
          </span>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all hover-elevate",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.badge && (
                  <span
                    className={cn(
                      "ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : "bg-destructive text-destructive-foreground"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-[72px] md:pb-0">
        <div className="h-full w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-card/80 backdrop-blur-xl px-2 pb-safe pt-2 md:hidden">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center p-2 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-10 w-10 items-center justify-center rounded-full transition-all",
                  isActive ? "bg-primary/10" : "bg-transparent"
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <span className="sr-only">{item.label}</span>
              {item.badge && (
                <span className="absolute right-2 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
        {/* Mobile Profile Link */}
        <Link
          href="/profile"
          className={cn(
            "relative flex flex-col items-center p-2 text-xs font-medium transition-colors",
            location === "/profile" ? "text-primary" : "text-muted-foreground"
          )}
        >
          <div
            className={cn(
              "mb-1 flex h-10 w-10 items-center justify-center rounded-full transition-all",
              location === "/profile" ? "bg-primary/10" : "bg-transparent"
            )}
          >
            <User className="h-5 w-5" />
          </div>
          <span className="sr-only">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
