import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
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

  // Unread messages count — only conversations the current user is part of
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

  let newMessages = 0;
  if (userConvIds.length > 0) {
    const unreadMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.isRead, false));

    newMessages = unreadMessages.filter(
      (m) => m.senderId !== currentUserId && userConvIds.includes(m.conversationId)
    ).length;
  }

  // Recent matches (users from accepted connections)
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

  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const recentMatches = recentMatchConnections
    .map((c) => {
      const otherId = c.fromUserId === currentUserId ? c.toUserId : c.fromUserId;
      const user = userMap.get(otherId);
      return user ? formatUserProfile(user) : null;
    })
    .filter(Boolean);

  // Activity by category based on matched users' lookingFor values.
  const categoryMap = new Map<string, number>();
  for (const conn of matches) {
    const otherId = conn.fromUserId === currentUserId ? conn.toUserId : conn.fromUserId;
    const user = userMap.get(otherId);
    if (user) {
      for (const lf of user.lookingFor) {
        categoryMap.set(lf, (categoryMap.get(lf) ?? 0) + 1);
      }
    }
  }

  const activityByCategory = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
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
