import { Router, type IRouter } from "express";
import { eq, and, or, desc, inArray, count, ne } from "drizzle-orm";
import { db, usersTable, connectionsTable, conversationsTable, messagesTable } from "@workspace/db";
import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { formatUserProfile } from "../lib/userProfile";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  // Total matches (accepted connections)
  const matches = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, currentUserId),
          eq(connectionsTable.toUserId, currentUserId)
        ),
        eq(connectionsTable.status, "accepted")
      )
    );

  // Pending requests sent to current user
  const pendingRequests = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        eq(connectionsTable.toUserId, currentUserId),
        eq(connectionsTable.status, "pending")
      )
    );

  // Conversations the current user is part of
  const userConversations = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.user1Id, currentUserId),
        eq(conversationsTable.user2Id, currentUserId)
      )
    );

  const userConvIds = userConversations.map((c) => c.id);

  // Unread messages — scoped to user's conversations, not sent by current user
  // Single targeted query; never fetches messages from other users' conversations
  let newMessages = 0;
  if (userConvIds.length > 0) {
    const [unreadResult] = await db
      .select({ value: count() })
      .from(messagesTable)
      .where(
        and(
          inArray(messagesTable.conversationId, userConvIds),
          eq(messagesTable.isRead, false),
          ne(messagesTable.senderId, currentUserId)
        )
      );
    newMessages = unreadResult?.value ?? 0;
  }

  // Recent matches — fetch only the 5 most recent accepted connections
  const recentMatchConnections = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, currentUserId),
          eq(connectionsTable.toUserId, currentUserId)
        ),
        eq(connectionsTable.status, "accepted")
      )
    )
    .orderBy(desc(connectionsTable.createdAt))
    .limit(5);

  // Fetch only the users referenced by recent matches (not the whole table)
  const recentMatchUserIds = recentMatchConnections.map((c) =>
    c.fromUserId === currentUserId ? c.toUserId : c.fromUserId
  );

  const recentMatchUsers = recentMatchUserIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, recentMatchUserIds))
    : [];
  const recentUserMap = new Map(recentMatchUsers.map((u) => [u.id, u]));

  const recentMatches = recentMatchConnections
    .map((c) => {
      const otherId = c.fromUserId === currentUserId ? c.toUserId : c.fromUserId;
      const user = recentUserMap.get(otherId);
      return user ? formatUserProfile(user) : null;
    })
    .filter(Boolean);

  // Activity chart — based on matched users' lookingFor values.
  // Fetch only the matched partner users (capped at 500 matches max)
  const allMatchUserIds = matches
    .slice(0, 500)
    .map((c) => (c.fromUserId === currentUserId ? c.toUserId : c.fromUserId));

  const matchedUsers = allMatchUserIds.length > 0
    ? await db.select({ id: usersTable.id, lookingFor: usersTable.lookingFor })
        .from(usersTable)
        .where(inArray(usersTable.id, allMatchUserIds))
    : [];

  const categoryMap = new Map<string, number>();
  for (const user of matchedUsers) {
    for (const lf of user.lookingFor) {
      categoryMap.set(lf, (categoryMap.get(lf) ?? 0) + 1);
    }
  }

  const activityByCategory = Array.from(categoryMap.entries())
    .map(([category, value]) => ({ category, count: value }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  res.json(
    GetDashboardStatsResponse.parse({
      totalMatches: matches.length,
      pendingRequests: pendingRequests.length,
      newMessages,
      profileViews: 0,
      recentMatches,
      activityByCategory,
    })
  );
});

export default router;
