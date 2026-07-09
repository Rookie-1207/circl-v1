import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { formatUserProfile } from "../lib/userProfile";
import {
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, currentUserId))
    .orderBy(desc(notificationsTable.createdAt));

  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const result = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    actorId: n.actorId ?? null,
    actor: n.actorId ? formatUserProfile(userMap.get(n.actorId)!) : undefined,
    createdAt: n.createdAt.toISOString(),
  }));

  res.json(ListNotificationsResponse.parse(result));
});

router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const updated = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.userId, currentUserId),
        eq(notificationsTable.isRead, false)
      )
    )
    .returning();

  res.json(MarkAllNotificationsReadResponse.parse({ count: updated.length }));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const pathParams = MarkNotificationReadParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, pathParams.data.id),
        eq(notificationsTable.userId, currentUserId)
      )
    )
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  res.json(
    MarkNotificationReadResponse.parse({
      id: notification.id,
      type: notification.type,
      message: notification.message,
      isRead: notification.isRead,
      actorId: notification.actorId ?? null,
      actor: notification.actorId ? formatUserProfile(userMap.get(notification.actorId)!) : undefined,
      createdAt: notification.createdAt.toISOString(),
    })
  );
});

export default router;
