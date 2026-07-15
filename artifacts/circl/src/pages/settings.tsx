import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Moon, Sun, Monitor, LogOut, Trash2, UserX, ShieldOff } from "lucide-react";
import { useGetMyProfile, useDeleteMyAccount, useListBlockedUsers, useUnblockUser } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { UserAvatar } from "@/components/user-avatar";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { data: profile } = useGetMyProfile();
  const { logout, session } = useAuth();
  const { toast } = useToast();

  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteAccount = useDeleteMyAccount();

  // Blocked users
  const { data: blockedUsers, refetch: refetchBlocked } = useListBlockedUsers();
  const unblockUser = useUnblockUser();

  const handleLogout = async () => {
    const error = await logout();
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast({ title: "Please enter your password to confirm.", variant: "destructive" });
      return;
    }
    if (!session?.user?.email) {
      toast({ title: "Could not find your account email.", variant: "destructive" });
      return;
    }

    setIsDeleting(true);

    // Step 1: Verify password via Supabase re-authentication
    const { error: verifyError } = await supabase!.auth.signInWithPassword({
      email: session.user.email,
      password: deletePassword,
    });

    if (verifyError) {
      setIsDeleting(false);
      toast({
        title: "Incorrect password",
        description: "Please double-check your password and try again.",
        variant: "destructive",
      });
      return;
    }

    // Step 2: Soft-delete account via API
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        toast({
          title: "Account deleted",
          description: "Your account has been scheduled for permanent deletion in 30 days. You have been signed out.",
        });
        setDeleteDialogOpen(false);
        // Step 3: Sign out immediately
        await logout();
      },
      onError: () => {
        setIsDeleting(false);
        toast({
          title: "Something went wrong",
          description: "Could not delete your account. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleUnblock = (userId: number, userName: string) => {
    unblockUser.mutate({ id: userId }, {
      onSuccess: () => {
        toast({ title: `${userName} has been unblocked.` });
        refetchBlocked();
      },
      onError: () => {
        toast({ title: "Failed to unblock user. Please try again.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account preferences and app experience.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-display">Appearance</CardTitle>
            <CardDescription>Customize how Circl looks on your device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Button
                variant="outline"
                className={`h-24 flex-col gap-2 ${theme === 'light' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                onClick={() => setTheme("light")}
              >
                <Sun className="h-6 w-6" />
                Light
              </Button>
              <Button
                variant="outline"
                className={`h-24 flex-col gap-2 ${theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-6 w-6" />
                Dark
              </Button>
              <Button
                variant="outline"
                className={`h-24 flex-col gap-2 ${theme === 'system' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                onClick={() => setTheme("system")}
              >
                <Monitor className="h-6 w-6" />
                System
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-display">Notifications</CardTitle>
            <CardDescription>Control when you get pinged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Matches</Label>
                <p className="text-sm text-muted-foreground">When someone accepts your request</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Messages</Label>
                <p className="text-sm text-muted-foreground">When you receive a new chat message</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Connection Requests</Label>
                <p className="text-sm text-muted-foreground">When someone wants to connect</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Blocked Users */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Blocked Users
            </CardTitle>
            <CardDescription>People you've blocked can't see you or contact you.</CardDescription>
          </CardHeader>
          <CardContent>
            {!blockedUsers || blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">You haven't blocked anyone.</p>
            ) : (
              <div className="space-y-3">
                {blockedUsers.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={entry.blockedUser} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{entry.blockedUser.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.blockedUser.university}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleUnblock(entry.blockedUser.id, entry.blockedUser.name)}
                      disabled={unblockUser.isPending}
                    >
                      <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="border-none shadow-sm border-destructive/20">
          <CardHeader>
            <CardTitle className="font-display text-destructive">Account</CardTitle>
            <CardDescription>Manage your session and data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile && (
              <div className="bg-secondary/50 p-4 rounded-lg flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-sm">{profile.name}</p>
                  <p className="text-muted-foreground text-xs">Account in good standing</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="destructive" className="w-full sm:w-auto" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </Button>

              <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setDeletePassword("");
              }}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          Your account will be <strong>soft-deleted immediately</strong> and permanently removed after 30 days.
                          During that window you can contact support to reverse it.
                        </p>
                        <p>
                          Enter your password to confirm.
                        </p>
                        <Input
                          type="password"
                          placeholder="Your password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleDeleteAccount(); }}
                          autoFocus
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAccount();
                      }}
                      disabled={isDeleting || !deletePassword.trim()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Deleting…" : "Yes, delete my account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
