import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  bio: z.string().max(160, "Bio must not be longer than 160 characters.").optional().nullable(),
  goals: z.string().max(160).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [interests, setInterests] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  
  const [newInterest, setNewInterest] = useState("");
  const [newLookingFor, setNewLookingFor] = useState("");
  const [newAvailability, setNewAvailability] = useState("");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      bio: "",
      goals: "",
      avatarUrl: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        bio: profile.bio || "",
        goals: profile.goals || "",
        avatarUrl: profile.avatarUrl || "",
      });
      setInterests(profile.interests);
      setLookingFor(profile.lookingFor);
      setAvailability(profile.availability);
    }
  }, [profile, form]);

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile.mutate(
      { 
        data: { 
          ...data, 
          interests, 
          lookingFor, 
          availability,
          bio: data.bio || undefined,
          goals: data.goals || undefined,
          avatarUrl: data.avatarUrl || undefined,
        } 
      },
      {
        onSuccess: (updatedProfile) => {
          toast({ title: "Profile updated successfully!" });
          queryClient.setQueryData(getGetMyProfileQueryKey(), updatedProfile);
        },
        onError: () => {
          toast({ title: "Failed to update profile", variant: "destructive" });
        }
      }
    );
  };

  const handleAddItem = (
    value: string, 
    setter: React.Dispatch<React.SetStateAction<string[]>>, 
    list: string[], 
    inputSetter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (value.trim() && !list.includes(value.trim())) {
      setter([...list, value.trim()]);
      inputSetter("");
    }
  };

  const handleRemoveItem = (itemToRemove: string, setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[]) => {
    setter(list.filter(i => i !== itemToRemove));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update how others see you on campus.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-card p-6 rounded-2xl border shadow-sm">
        <UserAvatar user={profile} className="h-24 w-24 text-2xl" />
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-display font-bold">{profile.name}</h2>
          <p className="text-muted-foreground">{profile.university}</p>
          <div className="mt-2 text-xs font-mono bg-secondary px-2 py-1 rounded inline-block">
            Member since {new Date(profile.createdAt).getFullYear()}
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="bg-card p-6 rounded-2xl border shadow-sm space-y-6">
            <h3 className="font-display font-bold text-lg border-b pb-2">Basic Info</h3>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-secondary/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value || ""} 
                      className="resize-none bg-secondary/50" 
                      rows={3}
                      placeholder="Tell people a bit about yourself..."
                    />
                  </FormControl>
                  <FormDescription>Max 160 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Goals</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ""} 
                      className="bg-secondary/50" 
                      placeholder="e.g. Run a 5k, Learn React, Build a startup"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} className="bg-secondary/50" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="bg-card p-6 rounded-2xl border shadow-sm space-y-8">
            <h3 className="font-display font-bold text-lg border-b pb-2">Tags & Details</h3>
            
            {/* Interests */}
            <div className="space-y-3">
              <FormLabel>Interests</FormLabel>
              <div className="flex flex-wrap gap-2">
                {interests.map(interest => (
                  <Badge key={interest} variant="secondary" className="px-3 py-1 text-sm">
                    {interest}
                    <button type="button" onClick={() => handleRemoveItem(interest, setInterests, interests)} className="ml-2 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newInterest} 
                  onChange={e => setNewInterest(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem(newInterest, setInterests, interests, setNewInterest);
                    }
                  }}
                  placeholder="Add an interest..." 
                  className="bg-secondary/50"
                />
                <Button type="button" variant="outline" onClick={() => handleAddItem(newInterest, setInterests, interests, setNewInterest)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Looking For */}
            <div className="space-y-3">
              <FormLabel>Looking For</FormLabel>
              <div className="flex flex-wrap gap-2">
                {lookingFor.map(item => (
                  <Badge key={item} variant="outline" className="px-3 py-1 text-sm border-primary/30 bg-primary/5 text-primary">
                    {item}
                    <button type="button" onClick={() => handleRemoveItem(item, setLookingFor, lookingFor)} className="ml-2 opacity-70 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newLookingFor} 
                  onChange={e => setNewLookingFor(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem(newLookingFor, setLookingFor, lookingFor, setNewLookingFor);
                    }
                  }}
                  placeholder="e.g. Gym Partner, Study Group..." 
                  className="bg-secondary/50"
                />
                <Button type="button" variant="outline" onClick={() => handleAddItem(newLookingFor, setLookingFor, lookingFor, setNewLookingFor)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-3">
              <FormLabel>Availability</FormLabel>
              <div className="flex flex-wrap gap-2">
                {availability.map(item => (
                  <Badge key={item} variant="outline" className="px-3 py-1 text-sm">
                    {item}
                    <button type="button" onClick={() => handleRemoveItem(item, setAvailability, availability)} className="ml-2 opacity-70 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newAvailability} 
                  onChange={e => setNewAvailability(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem(newAvailability, setAvailability, availability, setNewAvailability);
                    }
                  }}
                  placeholder="e.g. Weekday evenings, Weekends..." 
                  className="bg-secondary/50"
                />
                <Button type="button" variant="outline" onClick={() => handleAddItem(newAvailability, setAvailability, availability, setNewAvailability)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" className="rounded-full px-8 shadow-md" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
