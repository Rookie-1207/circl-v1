import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable, connectionsTable } from "@workspace/db";
import { z } from "zod";
import {
  GetMyProfileResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
  DiscoverUsersQueryParams,
  DiscoverUsersResponseItem,
  GetUserProfileParams,
  GetUserProfileResponse,
} from "@workspace/api-zod";
import { formatUserProfile } from "../lib/userProfile";

const router: IRouter = Router();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(300)
  .optional()
  .or(z.literal("").transform(() => null));

const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((items) => Array.from(new Set(items)));

const ProfileUpdateValidation = UpdateMyProfileBody.extend({
  name: z.string().trim().min(2).max(80).optional(),
  bio: optionalText(500),
  department: optionalText(120),
  year: optionalText(40),
  section: optionalText(40),
  studentType: z.enum(["hostel", "day_scholar"]).optional(),
  githubUrl: optionalUrl.optional(),
  linkedinUrl: optionalUrl.optional(),
  interests: tagList.optional(),
  lookingFor: tagList.optional(),
  availability: tagList.optional(),
  goals: optionalText(500),
  avatarUrl: optionalUrl.optional(),
});

router.get("/users/me", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, currentUserId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(
    GetMyProfileResponse.parse(formatUserProfile(user))
  );
});

router.patch("/users/me", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const parsed = ProfileUpdateValidation.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, currentUserId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(
    UpdateMyProfileResponse.parse(formatUserProfile(updated))
  );
});

router.get("/users", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const params = DiscoverUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { category, search, university } = params.data;

  // Get connection ids to exclude already-connected users
  const existingConnections = await db
    .select({ toUserId: connectionsTable.toUserId, fromUserId: connectionsTable.fromUserId })
    .from(connectionsTable)
    .where(
      or(
        eq(connectionsTable.fromUserId, currentUserId),
        eq(connectionsTable.toUserId, currentUserId)
      )
    );

  const excludedIds = new Set<number>([currentUserId]);
  for (const conn of existingConnections) {
    excludedIds.add(conn.fromUserId);
    excludedIds.add(conn.toUserId);
  }

  let users = await db.select().from(usersTable);

  // Filter out current user and existing connections
  users = users.filter((u) => !excludedIds.has(u.id));

  // Apply search filter
  if (search) {
    const lower = search.toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(lower) ||
        u.university.toLowerCase().includes(lower) ||
        (u.bio?.toLowerCase().includes(lower) ?? false)
    );
  }

  // Apply university filter
  if (university) {
    users = users.filter((u) =>
      u.university.toLowerCase().includes(university.toLowerCase())
    );
  }

  // Apply category filter (match against lookingFor)
  if (category) {
    users = users.filter((u) =>
      u.lookingFor.some((lf: string) =>
        lf.toLowerCase().includes(category.toLowerCase())
      )
    );
  }

  // Compute compatibility score based on shared interests and lookingFor
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, currentUserId));

  const results = users.map((u) => {
    let score = 30; // base score
    if (currentUser) {
      const sharedInterests = u.interests.filter((i: string) =>
        currentUser.interests.includes(i)
      ).length;
      const sharedLookingFor = u.lookingFor.filter((lf: string) =>
        currentUser.lookingFor.includes(lf)
      ).length;
      const sharedAvailability = u.availability.filter((a: string) =>
        currentUser.availability.includes(a)
      ).length;
      score = Math.min(
        100,
        30 + sharedInterests * 15 + sharedLookingFor * 20 + sharedAvailability * 10
      );
    }

    return DiscoverUsersResponseItem.parse({
      user: formatUserProfile(u),
      compatibilityScore: score,
    });
  });

  // Sort by compatibility score descending
  results.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  res.json(results);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(
    GetUserProfileResponse.parse(formatUserProfile(user))
  );
});

export default router;
