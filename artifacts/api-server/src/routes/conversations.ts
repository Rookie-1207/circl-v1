import { Router, type IRouter } from "express";
import { eq, or, and, desc } from "drizzle-orm";
import { db, conversationsTable, messagesTable, usersTable } from "@workspace/db";
import { formatUserProfile } from "../lib/userProfile";
import {
  GetMessagesParams,
  GetMessagesResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
  ListConversationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/conversations", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const convs = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.user1Id, currentUserId),
        eq(conversationsTable.user2Id, currentUserId)
      )
    )
    .orderBy(desc(conversationsTable.updatedAt));

  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const result = await Promise.all(
    convs.map(async (conv) => {
      const otherId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
      const otherUser = userMap.get(otherId)!;

      const [lastMsg] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      const unreadRows = await db
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conv.id),
            eq(messagesTable.isRead, false)
          )
        );

      const unreadCount = unreadRows.filter((m) => m.senderId !== currentUserId).length;

      return {
        id: conv.id,
        otherUser: formatUserProfile(otherUser),
        lastMessage: lastMsg?.content ?? null,
        unreadCount,
        updatedAt: conv.updatedAt.toISOString(),
      };
    })
  );

  res.json(ListConversationsResponse.parse(result));
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const pathParams = GetMessagesParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  // Verify current user is a member of this conversation
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, pathParams.data.id),
        or(
          eq(conversationsTable.user1Id, currentUserId),
          eq(conversationsTable.user2Id, currentUserId)
        )
      )
    );

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, pathParams.data.id))
    .orderBy(messagesTable.createdAt);

  // Mark messages as read
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.conversationId, pathParams.data.id),
        eq(messagesTable.isRead, false),
        eq(messagesTable.senderId, conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id)
      )
    );

  res.json(
    GetMessagesResponse.parse(
      messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        content: m.content,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
      }))
    )
  );
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const pathParams = SendMessageParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  // Verify current user is a member of this conversation
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, pathParams.data.id),
        or(
          eq(conversationsTable.user1Id, currentUserId),
          eq(conversationsTable.user2Id, currentUserId)
        )
      )
    );

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const bodyParsed = SendMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: pathParams.data.id,
      senderId: currentUserId,
      content: bodyParsed.data.content,
      isRead: false,
    })
    .returning();

  // Update conversation updatedAt
  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, pathParams.data.id));

  res.status(201).json(
    SendMessageResponse.parse({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt.toISOString(),
    })
  );
});

export default router;
