import { useMemo, useState } from "react";
import { useDiscoverUsers, useCreateConnection } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Search, MapPin, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export default function Discover() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { toast } = useToast();

  const queryParams = {
    ...(search ? { search } : {}),
    ...(category !== "All" ? { category } : {}),
  };

  const { data: allResults } = useDiscoverUsers();
  const { data: results, isLoading, isError, refetch } = useDiscoverUsers(
    Object.keys(queryParams).length > 0 ? queryParams : undefined,
  );
  const createConnection = useCreateConnection();

  const categories = useMemo(() => {
    const liveCategories = new Set<string>();
    for (const result of allResults ?? []) {
      for (const item of result.user.lookingFor) {
        liveCategories.add(item);
      }
    }
    if (category !== "All") {
      liveCategories.add(category);
    }
    return ["All", ...Array.from(liveCategories).sort()];
  }, [allResults, category]);

  const handleConnect = (userId: number) => {
    createConnection.mutate(
      { data: { toUserId: userId, action: "connect" } },
      {
        onSuccess: () => {
          toast({ title: "Connection request sent!" });
          refetch();
        },
      }
    );
  };

  const handlePass = (userId: number) => {
    createConnection.mutate(
      { data: { toUserId: userId, action: "pass" } },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (score >= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-red-500/10 text-red-600 border-red-500/20";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Discover</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Find your next campus connection.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, interests..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={category === cat ? "default" : "secondary"}
            size="sm"
            className="rounded-full whitespace-nowrap"
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[380px] rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-display font-bold">Could not load people</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Try again in a moment.
          </p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : results && results.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result, index) => (
            <Card 
              key={result.user.id} 
              className="overflow-hidden border-none shadow-sm hover-elevate transition-all animate-in fade-in slide-in-from-bottom-8"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="h-24 bg-gradient-to-br from-primary/20 to-accent/50" />
              <CardContent className="px-6 pb-4 pt-0 relative">
                <div className="flex justify-between items-end mb-4">
                  <div className="-mt-12">
                    <UserAvatar user={result.user} className="h-24 w-24 border-4 border-card shadow-sm" showOnlineStatus />
                  </div>
                  <Badge variant="outline" className={cn("font-mono font-bold px-2 py-0.5", getScoreColor(result.compatibilityScore))}>
                    {result.compatibilityScore}% Match
                  </Badge>
                </div>
                
                <Link href={`/profile/${result.user.id}`}>
                  <h3 className="font-display font-bold text-xl hover:text-primary transition-colors">
                    {result.user.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {result.user.university}
                </div>
                
                {result.user.bio && (
                  <p className="mt-4 text-sm line-clamp-2 text-foreground/80">
                    {result.user.bio}
                  </p>
                )}
                
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {result.user.interests.slice(0, 3).map((interest) => (
                    <Badge key={interest} variant="secondary" className="text-[10px] font-medium px-2 py-0">
                      {interest}
                    </Badge>
                  ))}
                  {result.user.interests.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0">
                      +{result.user.interests.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="px-6 py-4 bg-secondary/30 flex gap-3">
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  onClick={() => handlePass(result.user.id)}
                  disabled={createConnection.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Pass
                </Button>
                <Button 
                  className="w-full rounded-xl"
                  onClick={() => handleConnect(result.user.id)}
                  disabled={createConnection.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-display font-bold">No new faces found</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            You've seen everyone who matches your current filters. Try adjusting your search or category.
          </p>
          <Button 
            variant="outline" 
            className="mt-6 rounded-full"
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
