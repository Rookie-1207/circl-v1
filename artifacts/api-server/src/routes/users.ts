import { Router, type IRouter } from "express";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { db, usersTable, connectionsTable } from "@workspace/db";
import {
  GetMyProfileResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
  DiscoverUsersQueryParams,
  DiscoverUsersResponseItem,
  GetUserProfileParams,
  GetUserProfileResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Mock current user id (auth not yet implemented)
const CURRENT_USER_ID = 1;

router.get("/users/me", async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, CURRENT_USER_ID));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(
    GetMyProfileResponse.parse({
      ...user,
      bio: user.bio ?? null,
      goals: user.goals ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
    })
  );
});

router.patch("/users/me", async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, CURRENT_USER_ID))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(
    UpdateMyProfileResponse.parse({
      ...updated,
      bio: updated.bio ?? null,
      goals: updated.goals ?? null,
      avatarUrl: updated.avatarUrl ?? null,
      createdAt: updated.createdAt.toISOString(),
    })
  );
});

router.get("/users", async (req, res): Promise<void> => {
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
        eq(connectionsTable.fromUserId, CURRENT_USER_ID),
        eq(connectionsTable.toUserId, CURRENT_USER_ID)
      )
    );

  const excludedIds = new Set<number>([CURRENT_USER_ID]);
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
    .where(eq(usersTable.id, CURRENT_USER_ID));

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
      user: {
        ...u,
        bio: u.bio ?? null,
        goals: u.goals ?? null,
        avatarUrl: u.avatarUrl ?? null,
        createdAt: u.createdAt.toISOString(),
      },
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
    GetUserProfileResponse.parse({
      ...user,
      bio: user.bio ?? null,
      goals: user.goals ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
    })
  );
});

export default router;
