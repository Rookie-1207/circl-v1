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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Upload, X, Plus, Save } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

const PROFILE_PHOTO_BUCKET =
  import.meta.env.VITE_SUPABASE_PROFILE_BUCKET?.trim() || "profile-photos";
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  bio: z.string().max(500, "Bio must not be longer than 500 characters.").optional().nullable(),
  department: z.string().max(120, "Department must not be longer than 120 characters.").optional().nullable(),
  year: z.string().max(40, "Year must not be longer than 40 characters.").optional().nullable(),
  section: z.string().max(40, "Section must not be longer than 40 characters.").optional().nullable(),
  studentType: z.enum(["hostel", "day_scholar"]).optional(),
  githubUrl: z.string().url("Enter a valid GitHub URL.").optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url("Enter a valid LinkedIn URL.").optional().nullable().or(z.literal("")),
  goals: z.string().max(500, "Goals must not be longer than 500 characters.").optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { data: profile, isLoading, isError, refetch } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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
      department: "",
      year: "",
      section: "",
      studentType: undefined,
      githubUrl: "",
      linkedinUrl: "",
      goals: "",
      avatarUrl: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        bio: profile.bio || "",
        department: profile.department || "",
        year: profile.year || "",
        section: profile.section || "",
        studentType: profile.studentType || undefined,
        githubUrl: profile.githubUrl || "",
        linkedinUrl: profile.linkedinUrl || "",
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
          department: data.department || undefined,
          year: data.year || undefined,
          section: data.section || undefined,
          studentType: data.studentType || undefined,
          githubUrl: data.githubUrl || undefined,
          linkedinUrl: data.linkedinUrl || undefined,
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
    if (list.length >= 20) {
      toast({ title: "You can add up to 20 items.", variant: "destructive" });
      return;
    }
    if (value.trim().length > 40) {
      toast({ title: "Keep each item under 40 characters.", variant: "destructive" });
      return;
    }
    if (value.trim() && !list.includes(value.trim())) {
      setter([...list, value.trim()]);
      inputSetter("");
    }
  };

  const handleRemoveItem = (itemToRemove: string, setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[]) => {
    setter(list.filter(i => i !== itemToRemove));
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile) return;

    if (!supabase || !authUser) {
      toast({ title: "Photo upload is not configured.", variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file.", variant: "destructive" });
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      toast({ title: "Profile photo must be under 5 MB.", variant: "destructive" });
      return;
    }

    setIsUploadingPhoto(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${authUser.id}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (error) {
      setIsUploadingPhoto(false);
      toast({ title: error.message, variant: "destructive" });
      return;
    }

    const { data } = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path);
    updateProfile.mutate(
      { data: { avatarUrl: data.publicUrl } },
      {
        onSuccess: (updatedProfile) => {
          setIsUploadingPhoto(false);
          form.setValue("avatarUrl", data.publicUrl);
          queryClient.setQueryData(getGetMyProfileQueryKey(), updatedProfile);
          toast({ title: "Profile photo updated." });
        },
        onError: () => {
          setIsUploadingPhoto(false);
          toast({ title: "Failed to save profile photo", variant: "destructive" });
        },
      },
    );
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

  if (isError) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Update how others see you on campus.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border shadow-sm">
          <AlertCircle className="h-10 w-10 mb-4 text-muted-foreground" />
          <h2 className="text-xl font-display font-bold">Could not load profile</h2>
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
        <div className="flex flex-col items-center gap-3">
          <UserAvatar user={profile} className="h-24 w-24 text-2xl" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={isUploadingPhoto || updateProfile.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploadingPhoto ? "Uploading..." : "Upload photo"}
          </Button>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-display font-bold">{profile.name}</h2>
          <p className="text-muted-foreground">{profile.university}</p>
          <div className="mt-2 text-xs font-mono bg-secondary px-2 py-1 rounded inline-block">
            Member since {new Date(profile.createdAt).getFullYear()}
          </div>
          <div className="mt-4 w-56 max-w-full">
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span>Profile completion</span>
              <span>{profile.profileCompletion}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${profile.profileCompletion}%` }} />
            </div>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} className="bg-secondary/50" placeholder="e.g. Computer Science" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} className="bg-secondary/50" placeholder="e.g. 3rd Year" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} className="bg-secondary/50" placeholder="e.g. A" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="studentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hostel / Day Scholar</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary/50">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hostel">Hostel</SelectItem>
                        <SelectItem value="day_scholar">Day Scholar</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="githubUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} className="bg-secondary/50" placeholder="https://github.com/..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="linkedinUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} className="bg-secondary/50" placeholder="https://linkedin.com/in/..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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
