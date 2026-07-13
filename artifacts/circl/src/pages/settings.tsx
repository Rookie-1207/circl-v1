import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, LogOut } from "lucide-react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { data: profile } = useGetMyProfile();
  const { logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    const error = await logout();
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    }
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
            <Button variant="destructive" className="w-full sm:w-auto" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Log out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
