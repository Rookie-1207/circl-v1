import { Router, type IRouter } from "express";
import { eq, and, or, inArray } from "drizzle-orm";
import { db, connectionsTable, usersTable, conversationsTable, notificationsTable } from "@workspace/db";
import { formatUserProfile } from "../lib/userProfile";
import {
  ListConnectionsQueryParams,
  ListConnectionsResponse,
  CreateConnectionBody,
  CreateConnectionResponse,
  UpdateConnectionParams,
  UpdateConnectionBody,
  UpdateConnectionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/connections", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const params = ListConnectionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { status } = params.data;

  const connections = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, currentUserId),
          eq(connectionsTable.toUserId, currentUserId)
        ),
        status ? eq(connectionsTable.status, status) : undefined
      )
    );

  // Fetch only the users referenced by these connections (not full table)
  const userIds = [...new Set(connections.flatMap((c) => [c.fromUserId, c.toUserId]))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = connections.map((c) => ({
    id: c.id,
    fromUserId: c.fromUserId,
    toUserId: c.toUserId,
    status: c.status,
    fromUser: c.fromUserId ? formatUserProfile(userMap.get(c.fromUserId)!) : undefined,
    toUser: c.toUserId ? formatUserProfile(userMap.get(c.toUserId)!) : undefined,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json(ListConnectionsResponse.parse(result));
});

router.post("/connections", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const parsed = CreateConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { toUserId, action } = parsed.data;
  const status = action === "connect" ? "pending" : "passed";

  // Prevent self-connections
  if (toUserId === currentUserId) {
    res.status(400).json({ error: "Cannot connect with yourself" });
    return;
  }

  const [connection] = await db
    .insert(connectionsTable)
    .values({
      fromUserId: currentUserId,
      toUserId,
      status,
    })
    .onConflictDoNothing({ target: [connectionsTable.fromUserId, connectionsTable.toUserId] })
    .returning();

  if (!connection) {
    res.status(409).json({ error: "Connection already exists" });
    return;
  }

  // Fetch only the two involved users
  const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, currentUserId));
  const [toUser] = await db.select().from(usersTable).where(eq(usersTable.id, toUserId));

  // Create notification for connect requests
  if (action === "connect") {
    await db.insert(notificationsTable).values({
      userId: toUserId,
      type: "connection_request",
      message: `${fromUser?.name ?? "Someone"} wants to connect with you`,
      actorId: currentUserId,
    });
  }

  res.status(201).json(
    CreateConnectionResponse.parse({
      id: connection.id,
      fromUserId: connection.fromUserId,
      toUserId: connection.toUserId,
      status: connection.status,
      fromUser: fromUser ? formatUserProfile(fromUser) : undefined,
      toUser: toUser ? formatUserProfile(toUser) : undefined,
      createdAt: connection.createdAt.toISOString(),
    })
  );
});

router.patch("/connections/:id", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const pathParams = UpdateConnectionParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const bodyParsed = UpdateConnectionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  // Only the recipient (toUserId) can accept/reject a connection
  const [connection] = await db
    .update(connectionsTable)
    .set({ status: bodyParsed.data.status })
    .where(
      and(
        eq(connectionsTable.id, pathParams.data.id),
        eq(connectionsTable.toUserId, currentUserId)
      )
    )
    .returning();

  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  // If accepted, create a conversation and notify the requester
  if (bodyParsed.data.status === "accepted") {
    const existingConv = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(
            eq(conversationsTable.user1Id, connection.fromUserId),
            eq(conversationsTable.user2Id, connection.toUserId)
          ),
          and(
            eq(conversationsTable.user1Id, connection.toUserId),
            eq(conversationsTable.user2Id, connection.fromUserId)
          )
        )
      );

    if (existingConv.length === 0) {
      await db.insert(conversationsTable).values({
        user1Id: connection.fromUserId,
        user2Id: connection.toUserId,
      });
    }

    // Notify the requester
    const [acceptingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, currentUserId));

    await db.insert(notificationsTable).values({
      userId: connection.fromUserId,
      type: "connection_accepted",
      message: `${acceptingUser?.name ?? "Someone"} accepted your connection request`,
      actorId: connection.toUserId,
    });
  }

  // Fetch only the two involved users
  const involvedUserIds = [connection.fromUserId, connection.toUserId];
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, involvedUserIds));
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(
    UpdateConnectionResponse.parse({
      id: connection.id,
      fromUserId: connection.fromUserId,
      toUserId: connection.toUserId,
      status: connection.status,
      fromUser: formatUserProfile(userMap.get(connection.fromUserId)!),
      toUser: formatUserProfile(userMap.get(connection.toUserId)!),
      createdAt: connection.createdAt.toISOString(),
    })
  );
});

export default router;
