import { Router, type IRouter } from "express";
import { eq, or, and, desc, inArray, count, ne } from "drizzle-orm";
import { db, conversationsTable, messagesTable, usersTable } from "@workspace/db";
import { formatUserProfile } from "../lib/userProfile";
import { areUsersBlocked, getBlockedUserIds } from "../lib/blocks";
import {
  GetMessagesParams,
  GetMessagesResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
  ListConversationsResponse,
} from "@workspace/api-zod";
import { z } from "zod";

// Message content cap — enforced here since SendMessageBody is generated
const MESSAGE_MAX_LENGTH = 4000;
const SafeSendMessageBody = SendMessageBody.and(
  z.object({ content: z.string().min(1).max(MESSAGE_MAX_LENGTH) })
);

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

  if (convs.length === 0) {
    res.json(ListConversationsResponse.parse([]));
    return;
  }

  // Fetch only the "other" users — not the whole users table
  const otherUserIds = [...new Set(
    convs.map((c) => c.user1Id === currentUserId ? c.user2Id : c.user1Id)
  )];
  const otherUsers = await db.select().from(usersTable).where(inArray(usersTable.id, otherUserIds));
  const userMap = new Map(otherUsers.map((u) => [u.id, u]));

  // Get blocked user IDs to filter conversations
  const blockedIds = await getBlockedUserIds(currentUserId);

  // Filter out conversations where the other party is blocked
  const visibleConvs = convs.filter((c) => {
    const otherId = c.user1Id === currentUserId ? c.user2Id : c.user1Id;
    return !blockedIds.has(otherId);
  });

  if (visibleConvs.length === 0) {
    res.json(ListConversationsResponse.parse([]));
    return;
  }

  const convIds = visibleConvs.map((c) => c.id);

  // Batch: unread counts per conversation in one query (not N+1)
  const unreadRows = await db
    .select({ conversationId: messagesTable.conversationId, value: count() })
    .from(messagesTable)
    .where(
      and(
        inArray(messagesTable.conversationId, convIds),
        eq(messagesTable.isRead, false),
        ne(messagesTable.senderId, currentUserId)
      )
    )
    .groupBy(messagesTable.conversationId);
  const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.value]));

  // Batch: most-recent message per conversation in one query
  // Fetch recent messages ordered desc, pick first seen per conversation_id
  const recentMessages = await db
    .select()
    .from(messagesTable)
    .where(inArray(messagesTable.conversationId, convIds))
    .orderBy(desc(messagesTable.createdAt))
    .limit(convIds.length * 5); // generous bound: 5 messages per conv max fetched

  const lastMsgMap = new Map<number, typeof recentMessages[0]>();
  for (const msg of recentMessages) {
    if (!lastMsgMap.has(msg.conversationId)) {
      lastMsgMap.set(msg.conversationId, msg);
    }
  }

  const result = visibleConvs.map((conv) => {
    const otherId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
    const otherUser = userMap.get(otherId)!;
    const lastMsg = lastMsgMap.get(conv.id);
    return {
      id: conv.id,
      otherUser: formatUserProfile(otherUser),
      lastMessage: lastMsg?.content ?? null,
      unreadCount: unreadMap.get(conv.id) ?? 0,
      updatedAt: conv.updatedAt.toISOString(),
    };
  });

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
    .orderBy(messagesTable.createdAt)
    .limit(500); // cap at 500 messages per load

  // Mark messages as read (only messages from the other party)
  const otherUserId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.conversationId, pathParams.data.id),
        eq(messagesTable.isRead, false),
        eq(messagesTable.senderId, otherUserId)
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

  // Block check — prevent messaging between blocked users
  const otherUserId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
  if (await areUsersBlocked(currentUserId, otherUserId)) {
    res.status(403).json({ error: "You cannot message this user" });
    return;
  }

  // Use the length-capped body schema
  const bodyParsed = SafeSendMessageBody.safeParse(req.body);
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
