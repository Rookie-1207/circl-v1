import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db, usersTable, connectionsTable, conversationsTable, messagesTable, notificationsTable } from "@workspace/db";
import { GetDashboardStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const CURRENT_USER_ID = 1;

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    ...u,
    bio: u.bio ?? null,
    goals: u.goals ?? null,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  // Total matches (accepted connections)
  const matches = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, CURRENT_USER_ID),
          eq(connectionsTable.toUserId, CURRENT_USER_ID)
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
        eq(connectionsTable.toUserId, CURRENT_USER_ID),
        eq(connectionsTable.status, "pending")
      )
    );

  // Unread messages count — only conversations the current user is part of
  const userConversations = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.user1Id, CURRENT_USER_ID),
        eq(conversationsTable.user2Id, CURRENT_USER_ID)
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
      (m) => m.senderId !== CURRENT_USER_ID && userConvIds.includes(m.conversationId)
    ).length;
  }

  // Profile views (random-ish for now based on notifications count)
  const allNotifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, CURRENT_USER_ID));

  const profileViews = allNotifications.length * 3 + 12;

  // Recent matches (users from accepted connections)
  const recentMatchConnections = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, CURRENT_USER_ID),
          eq(connectionsTable.toUserId, CURRENT_USER_ID)
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
      const otherId = c.fromUserId === CURRENT_USER_ID ? c.toUserId : c.fromUserId;
      const user = userMap.get(otherId);
      return user ? formatUser(user) : null;
    })
    .filter(Boolean);

  // Activity by category (based on all users' lookingFor)
  const categoryMap = new Map<string, number>();
  for (const conn of matches) {
    const otherId = conn.fromUserId === CURRENT_USER_ID ? conn.toUserId : conn.fromUserId;
    const user = userMap.get(otherId);
    if (user) {
      for (const lf of user.lookingFor) {
        categoryMap.set(lf, (categoryMap.get(lf) ?? 0) + 1);
      }
    }
  }

  // If no activity yet, show some placeholder categories from all users
  if (categoryMap.size === 0) {
    for (const user of allUsers) {
      if (user.id !== CURRENT_USER_ID) {
        for (const lf of user.lookingFor.slice(0, 1)) {
          categoryMap.set(lf, (categoryMap.get(lf) ?? 0) + 1);
        }
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
      profileViews,
      recentMatches,
      activityByCategory,
    })
  );
});

export default router;
