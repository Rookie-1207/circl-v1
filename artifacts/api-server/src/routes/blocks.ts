import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, userBlocksTable, usersTable } from "@workspace/db";
import { z } from "zod";
import { formatUserProfile } from "../lib/userProfile";

const router: IRouter = Router();

const IdParams = z.object({ id: z.coerce.number().int().positive() });

// GET /users/me/blocks — list users blocked by current user
router.get("/users/me/blocks", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const blocks = await db
    .select()
    .from(userBlocksTable)
    .where(eq(userBlocksTable.blockerId, currentUserId))
    .orderBy(userBlocksTable.createdAt);

  if (blocks.length === 0) {
    res.json([]);
    return;
  }

  const blockedIds = blocks.map((b) => b.blockedId);
  const users = await db
    .select()
    .from(usersTable)
    .where(
      or(...blockedIds.map((id) => eq(usersTable.id, id))),
    );
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = blocks.map((b) => {
    const user = userMap.get(b.blockedId);
    return {
      id: b.id,
      blockedUser: user ? formatUserProfile(user) : null,
      createdAt: b.createdAt.toISOString(),
    };
  }).filter((b) => b.blockedUser !== null);

  res.json(result);
});

// POST /users/:id/block — block a user
router.post("/users/:id/block", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const targetId = params.data.id;

  if (targetId === currentUserId) {
    res.status(400).json({ error: "Cannot block yourself" });
    return;
  }

  // Verify target user exists
  const [targetUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .insert(userBlocksTable)
    .values({ blockerId: currentUserId, blockedId: targetId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// DELETE /users/:id/block — unblock a user
router.delete("/users/:id/block", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  await db
    .delete(userBlocksTable)
    .where(
      and(
        eq(userBlocksTable.blockerId, currentUserId),
        eq(userBlocksTable.blockedId, params.data.id),
      ),
    );

  res.json({ ok: true });
});

export default router;
